# Integration handoff — 24 September 2026

Prepared from `main` commit `0a68d7f49682138bec04dd87b4bc71da2b3f5791` on local branch `integration/unified-erp`.

## Implemented

- One Express API and React/Vite frontend with shared cookie sessions and canonical user accounts.
- First-time account activation, SMTP OTP delivery, role/department permissions and account freezing.
- Saved timetable grids supply staff/student schedules and leave coverage; scheduling staff are explicitly linked to user accounts.
- One leave application per date range, all-period coverage gate, transaction-backed acceptance and approvals, department review and balance posting.
- Notices, scoped feed, notifications, attachments, approval rules and academic cycle management.
- Root install/build/start commands, local replica-set compose configuration and CI workflow.
- Committed environment files removed from this branch and replaced by placeholders. Rotate previously exposed credentials; history is not erased.

## Verification

- `npm test`: **49 passed, 0 failed** (existing generator/leave regressions plus shared policy/adapter tests).
- `npm run build`: **passed**.
- Six database integration tests have been added, but their shared MongoDB setup fails in this runtime (`Operation not permitted` / exit 100). Their application assertions have **not** been verified.
- Browser layout checks have **not** been verified: Chromium could not be downloaded in the provided runtime.
- No production or teammate database has been connected, changed or migrated. Use a fresh integration database and follow README.md.

## Publication blocker

GitHub rejected creation of the integration tree with `403: Resource not accessible by integration`. The account-level repository response reports push access, but the connected app could not perform this write. No remote branch, commit or PR was created, and `main` remains unchanged.

The repository connection needs permission to write code and, for the included CI workflow, workflow files. Reauthorize the connection before publishing. Do not share credentials in chat.

## Archive use

Extract this snapshot into a **new folder**. It contains the complete source snapshot and no Git history, installed dependencies, generated builds or live environment files. Start at README.md. It is an integration candidate, not a production-certified release. GitHub publication and database/browser acceptance checks remain pending.
