// Browser interaction checks against deterministic API fixtures. API/database
// behavior is tested separately by backend/tests/integration/workflow.test.js.
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const root = path.resolve(__dirname, "../dist");
const server = http.createServer(async (req, res) => {
  try {
    let file = path.join(root, new URL(req.url, "http://localhost").pathname);
    if (!file.startsWith(root + path.sep)) file = path.join(root, "index.html");
    try {
      if (!(await fs.stat(file)).isFile()) file = path.join(root, "index.html");
    } catch {
      file = path.join(root, "index.html");
    }
    res.setHeader(
      "Content-Type",
      {
        ".js": "text/javascript",
        ".css": "text/css",
        ".html": "text/html",
        ".svg": "image/svg+xml",
      }[path.extname(file)] || "application/octet-stream",
    );
    res.end(await fs.readFile(file));
  } catch {
    res.writeHead(500);
    res.end();
  }
});
const department = { _id: "d1", name: "Computer Science" };
const section = {
  _id: "s1",
  name: "CSE A",
  semester: 1,
  departmentId: "d1",
  classroom: "101",
};
const pending = {
  _id: "r1",
  name: "New Applicant",
  email: "new@example.edu",
  role: "student",
  status: "REQUESTED",
  departmentId: "d1",
  sectionId: "s1",
  currentSemester: 1,
};
async function fixture(browser, role) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const writes = [];
  const departments = [department],
    sections = [section],
    requests = [pending];
  const user = {
    _id: "u1",
    name: "Campus Tester",
    email: "tester@example.edu",
    role,
    status: "ACTIVE",
    departmentId: "d1",
    sectionId: "s1",
    assignedSectionIds: ["s1"],
  };
  await page.route("**/api/**", async (route) => {
    const request = route.request(),
      url = new URL(request.url()),
      p = url.pathname.replace("/api", ""),
      method = request.method();
    const body = request.postData() ? JSON.parse(request.postData()) : {};
    if (method !== "GET") writes.push({ p, body });
    let result = [],
      status = 200;
    if (p === "/auth/me") {
      result = role ? { user } : { message: "Sign in" };
      status = role ? 200 : 401;
    } else if (p === "/departments") {
      if (method === "POST") {
        departments.push({ _id: "d2", name: body.name });
        result = departments.at(-1);
      } else result = departments;
    } else if (p === "/sections") {
      if (method === "POST") {
        sections.push({ _id: "s2", ...body, semester: Number(body.semester) });
        result = sections.at(-1);
      } else result = sections;
    } else if (p === "/users/requests") result = requests;
    else if (p === "/users/r1/review") {
      requests.splice(0);
      result = { message: "Approved. The user can activate their account." };
    } else if (p === "/users") result = [user];
    else if (p === "/schedule/my")
      result = role === "student" ? [] : { days: [] };
    else if (p === "/leaves/balance")
      result = {
        firstHalfTotal: 7,
        firstHalfUsed: 0,
        secondHalfTotal: 8,
        secondHalfUsed: 0,
      };
    else if (p === "/auth/registration/options")
      result = { departments, sections };
    else if (p === "/auth/registration/request") {
      status = 202;
      result = {
        message:
          "Your request has been received. After Admin or Super Admin approval, use First-time activation.",
      };
    } else if (p === "/academic-cycle/preview")
      result = { students: [], currentCycle: null };
    else if (
      ![
        "/notifications",
        "/feed",
        "/notices",
        "/notices/mine",
        "/notices/pending",
        "/teachers",
        "/subjects",
        "/timetable",
        "/leaves/my",
        "/leaves/all",
        "/substitutes/my",
        "/substitutes/accepted",
      ].includes(p)
    ) {
      status = 404;
      result = { message: `Unhandled fixture: ${method} ${p}` };
      errors.push(result.message);
    }
    await route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(result),
    });
  });
  await page.goto(base);
  return { context, page, errors, writes };
}
let base;
(async () => {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true });
  try {
    for (const role of ["student", "teacher", "class_teacher"]) {
      const f = await fixture(browser, role),
        p = f.page;
      await p.locator(".user-app").waitFor();
      assert.deepEqual(
        (await p.locator("nav a").allTextContents()).map((s) =>
          s.slice(1).trim(),
        ),
        ["Overview", "Notice Board", "Timetable", "Leave Management"],
      );
      await p
        .getByRole("link", { name: "Notice Board", exact: false })
        .first()
        .click();
      assert.equal(
        await p.getByRole("button", { name: "+ Create notice" }).count(),
        0,
      );
      await p.locator('nav a[href="/leave"]').click();
      await p
        .getByRole("heading", { name: "Leave Management", exact: true })
        .waitFor();
      assert.equal(
        await p
          .getByRole("button", { name: /Request substitute|Assign selected/ })
          .count(),
        0,
      );
      await p.goto(base + "/people");
      await p.waitForURL(base + "/");
      assert.equal(await p.locator(".admin-app").count(), 0);
      await p.setViewportSize({ width: 390, height: 844 });
      await p.getByRole("button", { name: "Open navigation" }).click();
      assert.equal(await p.locator(".sidebar.open nav a").count(), 4);
      await p.locator('nav a[href="/schedule"]').click();
      await p
        .getByRole("heading", { name: "My timetable", exact: true })
        .waitFor();
      assert.equal(await p.locator(".sidebar.open").count(), 0);
      assert.equal(
        await p.evaluate(
          () => document.documentElement.scrollWidth > window.innerWidth,
        ),
        false,
      );
      assert.equal(f.writes.length, 0);
      assert.deepEqual(f.errors, []);
      await f.context.close();
      console.log(
        `PASS: ${role} four-item read-only interface, route protection and mobile navigation`,
      );
    }
    for (const role of ["super_admin", "admin", "principal", "hod"]) {
      const f = await fixture(browser, role),
        p = f.page;
      await p
        .getByRole("heading", { name: "Campus administration", exact: true })
        .waitFor();
      assert.equal(await p.locator(".admin-app").count(), 1);
      assert.equal(
        await p.locator('nav a[href="/account-requests"]').count(),
        ["admin", "super_admin"].includes(role) ? 1 : 0,
      );
      await p.locator('nav a[href="/timetable"]').click();
      await p
        .getByRole("heading", { name: "Create section", exact: true })
        .waitFor();
      const form = p.locator("form").filter({
        has: p.getByRole("button", { name: "Create section", exact: true }),
      });
      await form.getByLabel("Section name").fill("CSE B");
      await form.getByLabel("Department", { exact: true }).selectOption("d1");
      await form.getByLabel("Semester", { exact: true }).fill("3");
      await form.getByLabel("Classroom").fill("202");
      await form
        .getByRole("button", { name: "Create section", exact: true })
        .click();
      await p.getByRole("cell", { name: "CSE B", exact: true }).waitFor();
      assert.equal(f.writes.at(-1).body.departmentId, "d1");
      assert.deepEqual(f.errors, []);
      await f.context.close();
      console.log(
        `PASS: ${role} management interface and section creation dropdown`,
      );
    }
    {
      const f = await fixture(browser, null),
        p = f.page;
      await p
        .getByRole("button", { name: "Request an account", exact: true })
        .click();
      await p.getByLabel("Full name").fill("Applicant");
      await p.getByLabel("College email").fill("applicant@example.edu");
      await p.getByLabel("Department", { exact: true }).selectOption("d1");
      await p.getByLabel("Section", { exact: true }).selectOption("s1");
      assert.equal(
        await p
          .getByLabel("Requested role")
          .locator('option[value="admin"]')
          .count(),
        0,
      );
      await p.getByRole("button", { name: "Send account request" }).click();
      await p.getByRole("status").waitFor();
      assert.equal(f.writes.at(-1).body.sectionId, "s1");
      assert.deepEqual(f.errors, []);
      await f.context.close();
      console.log(
        "PASS: public account request sends selected department, semester and section",
      );
    }
    {
      const f = await fixture(browser, "super_admin"),
        p = f.page;
      await p.locator('nav a[href="/account-requests"]').click();
      await p.getByRole("button", { name: "Approve account" }).click();
      await p.getByText("No account requests awaiting review.").waitFor();
      assert.equal(f.writes.at(-1).body.action, "APPROVE");
      assert.deepEqual(f.errors, []);
      await f.context.close();
      console.log("PASS: admin account approval refreshes request queue");
    }
    {
      const f = await fixture(browser, "super_admin"),
        p = f.page;
      const appeal = {
        _id: "leave-test",
        teacher: { _id: "teacher-test", name: "Leave Teacher" },
        status: "coverage_pending",
        startDate: "2026-10-01",
        endDate: "2026-10-01",
        leaveType: "casual",
        substituteRequests: [],
      };
      await p.route("**/api/leaves/all", (route) =>
        route.fulfill({ json: [appeal] }),
      );
      await p.route("**/api/leaves/leave-test/reject", async (route) => {
        const body = route.request().postDataJSON();
        assert.equal(body.reason, "Coverage appeal withdrawn");
        appeal.status = "rejected";
        appeal.rejectionReason = body.reason;
        await route.fulfill({ json: appeal });
      });
      await p.locator('nav a[href="/leave"]').click();
      p.once("dialog", (dialog) => dialog.accept("Coverage appeal withdrawn"));
      await p
        .getByRole("button", { name: "Reject leave appeal", exact: true })
        .click();
      await p
        .getByText("Rejected: Coverage appeal withdrawn", { exact: true })
        .waitFor();
      assert.equal(
        await p
          .getByRole("button", { name: "Reject leave appeal", exact: true })
          .count(),
        0,
      );
      assert.deepEqual(f.errors, []);
      await f.context.close();
      console.log(
        "PASS: rejecting a pending coverage appeal refreshes status and rejection reason",
      );
    }
  } finally {
    await browser.close();
    server.close();
  }
})().catch((e) => {
  console.error(e);
  server.close();
  process.exitCode = 1;
});
