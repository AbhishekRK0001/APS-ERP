# APS ERP

One campus workspace for authentication, timetable generation, substitute coverage, leave approvals and notices.

## Run the integrated application

Use **Node.js 22.12 or newer** and a **MongoDB replica set** (Atlas works). Run commands from the repository root; do not start the original module servers.

```bash
npm ci
cp .env.example .env
```

On Windows PowerShell, use `Copy-Item .env.example .env`.

1. Fill in `MONGO_URI`, `APP_ORIGIN`, and a random `OTP_SECRET` of at least 32 characters. Generate a secret with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
2. For local MongoDB, run `docker compose up -d --wait`. The included development database binds to localhost and initializes a single-node replica set. It is not a production database deployment.
3. Set `BOOTSTRAP_EMAIL`, `BOOTSTRAP_PASSWORD` (12+ characters), and `BOOTSTRAP_NAME` in your local `.env`, then run `npm run bootstrap` once. It refuses to overwrite an existing super admin. Remove the bootstrap password from `.env` afterward.
4. Set SMTP settings for activation email. For local testing only, `DEV_OTP_CONSOLE=true` prints activation codes in the server terminal. This mode is disabled in production.
5. Run `npm run dev` and open **http://localhost:5173**. The frontend proxies `/api` to the backend on port 5000.

For a single production server, run `npm run build`, set `NODE_ENV=production` and `APP_ORIGIN` to your HTTPS origin, then `npm start`. Express serves the built frontend and API together. Configure HTTPS at your reverse proxy, persist the `uploads/` directory, and provide production MongoDB and SMTP credentials through your hosting environment. Do not expose the original module servers alongside this application.

## First setup in the UI

1. Sign in as the bootstrap administrator.
2. Open **Timetable studio**, create departments and sections.
3. Open **People & access**, create staff and student accounts. Assign students to a section matching their department and semester; assign teaching staff their sections. New users can request an account from the sign-in page. Admin/Super Admin must approve it in **Account requests** before **First-time activation** can send a code and let them set a password. Accounts created directly by authorized management are ready for activation.
4. Use **Link to timetable** for every teaching account. Imported scheduling profiles must be explicitly linked to their matching account; names are not used to guess identity.
5. Open **Subjects & faculty** to configure subjects, weekly loads, teacher assignments, batches and fixed slots.
6. Generate a timetable with its start and last working dates. Save it after checking the preview. Drag-and-drop and manual changes are validated on the server before saving.
7. Users see the saved grid in **Timetable**. Management records leave and substitute assignments in **Leave Management**, using the same grid, dates and staff account IDs.

## Runtime structure

| Location | Purpose |
| --- | --- |
| `backend/` | Shared Express entry point, canonical users, session login, OTP activation, role/scope rules, notices, uploads and academic cycles |
| `frontend/` | Unified React/Vite campus UI |
| `timetable/server/` | Reused generator, scheduling models and validated controllers |
| `leave-management/backend/` | Reused leave workflow and leave models, configured with the canonical user model and saved-grid timetable adapter |
| `authentication/`, `noticeboard/`, original module frontends | Original source retained for reference; not deployed or started by the root scripts |

The integrated runtime has one `User` model (`backend/models/User.js`), lowercase roles and one database connection. The original notice schema is preserved in the shared backend. Authentication uses an opaque, hashed server-side session and an HttpOnly SameSite cookie; logout revokes that session immediately. Original JWT or Next.js login endpoints are not mounted.

## Cross-module rules

- A scheduling `Teacher.userId` points to its canonical staff account. A section grid is the schedule source of truth; the old leave timetable collection is not used in the integrated application.
- Each scheduled period in the requested working-date range creates a coverage request under **one** leave application. Every period must be accepted before the leave reason can be submitted.
- A substitute must teach that same section during the working period, be free for the requested period, have no conflicting accepted cover, and have no overlapping active leave.
- Acceptance and approvals run in MongoDB transactions, with a shared campus write lock to serialize schedule/coverage changes. No non-transaction fallback is used by the integrated runtime. This correctness-first lock can be narrowed later if campus write volume requires it.
- HOD review is department-scoped. Principal approval follows HOD approval. Reviewers cannot approve their own leave. A staff member who is also HOD/Principal still needs a different authorized reviewer at each required stage; no self-approval bypass is provided.
- Rejection cancels the linked assignments and releases their occupied substitute slots. Final approval posts balances once, atomically.
- Current/future active leave workflows prevent schedule replacement/removal. Saved schedules must be removed before editing their subjects or section details. This intentionally prevents silent invalidation of coverage or references.
- Notices respect department/section/year/semester audiences. Only Principal, HOD, Admin and Super Admin can write notices. A manager can request review by another authorized manager. Notification reads and attachment downloads enforce the same audience rules; pending attachments are visible to authorized reviewers.
- Academic advancement clears student sections and invalidates their sessions. Semester-eight students become alumni. Assign new sections to promoted students using the People screen.
- Campus clock times follow the uploaded generator: 09:00–09:50, 09:50–10:40, break, 11:00–11:50, 11:50–12:40, lunch, 13:20–14:10, 14:10–15:00, 15:00–15:50. Leave dates are calendar dates, not timezone-shifted timestamps.

## Existing databases and credentials

Start with a **new database** for integration testing. No database on a teammate’s laptop or external server has been changed. Existing module databases contain incompatible user IDs, role names and timetable structures; pointing the unified application at one does not migrate it. Before importing real data, export/back up each source and prepare an explicit user/department/section/teacher ID mapping. Preserve password hashes through a reviewed migration and do not silently merge accounts by name. Legacy leave balances and pending requests require a separate reconciled migration.

Environment files previously committed to this public repository are removed on the integration branch. **Rotate any real database, email or signing credentials they contained.** This commit does not erase Git history or remove files still present on `main`; merge the removal and arrange history cleanup separately if necessary. Never commit live `.env` files.

## Verification

```bash
npm test
npm run build
npm run test:integration
```

The integration suite starts an isolated MongoDB replica set through `mongodb-memory-server`; it never reads `.env` or connects to a live campus database. It requires permission to run MongoDB and may download a MongoDB binary on first use. It checks session protection, OTP activation, logout, notice scope/approval, attachments, one-application coverage, concurrent acceptance, ordered approvals, balance posting and schedule protection. GitHub Actions runs the same checks.

Remaining production rollout work: configure real SMTP and database hosting, rotate exposed credentials, review/import existing data, verify institutional leave quotas/holiday rules and perform campus user acceptance testing. The inherited leave balance rule charges every calendar day in a requested date range; it does not infer holidays or weekends. The initial frontend can be refined without changing these API contracts.

## Interfaces and permissions

- Students, teachers and class teachers have exactly four navigation items: **Overview**, **Notice Board**, **Timetable**, **Leave Management**. Campus content and leave records are read-only for these roles. Sign-in/out, initial account requests and marking personal notifications read remain available.
- Principal, HOD, Admin and Super Admin use the separate management console. HOD changes remain department-scoped; campus-wide department and academic-cycle operations remain with Principal/Admin/Super Admin. The role hierarchy still prevents managing equal or higher accounts.
- Only Admin and Super Admin approve or reject public account requests. A request moves from `REQUESTED` to `PENDING` on approval, then `ACTIVE` after email OTP activation. Rejected or unreviewed requests cannot activate. Existing accounts are not changed by duplicate public requests.
- Per the read-only user rule, management records staff leave and assigns substitutes on their behalf. Select the absent staff member to create the request, then select an eligible substitute and use their **Substitute requests** tab to assign coverage. After all periods are covered, return to the absent staff member and submit the reason. HOD approval precedes Principal approval; Admin/Super Admin can process either stage. Self-approval remains blocked. Students see an explanatory page because the inherited workflow only models teaching-staff leave.
- Create a department, then a section with a semester and classroom, then active teaching accounts and scheduling links, then subjects. Section dropdowns filter by department/semester. An empty dropdown now explains the missing setup; no fictional departments or sections are seeded.
- Management can edit/delete unused departments and sections, set staff teaching constraints, assign account sections, and edit/delete notices. Saved schedules and live leave dependencies still block changes that would invalidate records.

GitHub Actions validates Compose syntax, regression tests, the production build, database integration workflows, and browser checks of all seven roles, section creation, mobile navigation and account requests. Browser checks use fixture API responses; database tests separately verify real authorization and persistence. To run browser checks locally after `npm run build`: `npm install --no-save --package-lock=false playwright@1.62.1`, `npx playwright install chromium`, then `node frontend/tests/smoke.cjs`.
