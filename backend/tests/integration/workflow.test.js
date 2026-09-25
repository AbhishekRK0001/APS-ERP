const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const request = require("supertest");
const bcrypt = require("bcryptjs");
const crypto = require("node:crypto");
const { MongoMemoryReplSet } = require("mongodb-memory-server");
process.env.NODE_ENV = "test";
process.env.APP_ORIGIN = "http://localhost:5173";
process.env.OTP_SECRET = crypto.randomBytes(32).toString("hex");
const app = require("../../app");
const User = require("../../models/User");
const Department = require("../../../timetable/server/models/Department");
const Section = require("../../../timetable/server/models/Section");
const Teacher = require("../../../timetable/server/models/Teacher");
const Timetable = require("../../../timetable/server/models/Timetable");
const Notice = require("../../models/Notice");
const Activation = require("../../models/Activation");
const Session = require("../../models/Session");
let db,
  users = {},
  agents = {},
  departments = {},
  section,
  otherSection,
  teacherProfiles = {},
  leaveId,
  requestIds,
  day;
before(
  async () => {
    db = await MongoMemoryReplSet.create({
      replSet: { count: 1 },
      binary: { version: "7.0.24" },
    });
    await mongoose.connect(db.getUri());
    await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
    departments.cse = await Department.create({ name: "Computer Science" });
    departments.ece = await Department.create({ name: "Electronics" });
    section = await Section.create({
      name: "CSE A",
      semester: 1,
      classroom: "101",
      departmentId: departments.cse._id,
    });
    otherSection = await Section.create({
      name: "ECE A",
      semester: 1,
      classroom: "102",
      departmentId: departments.ece._id,
    });
    const password = await bcrypt.hash("Test-password-123!", 4);
    for (const [key, role, dept] of [
      ["admin", "super_admin", "cse"],
      ["teacher", "teacher", "cse"],
      ["classTeacher", "class_teacher", "cse"],
      ["sub1", "teacher", "cse"],
      ["sub2", "teacher", "cse"],
      ["hod", "hod", "cse"],
      ["otherHod", "hod", "ece"],
      ["principal", "principal", "cse"],
      ["student", "student", "cse"],
      ["otherStudent", "student", "ece"],
    ]) {
      users[key] = await User.create({
        name: key,
        email: `${key.toLowerCase()}@test.invalid`,
        password,
        role,
        status: "ACTIVE",
        departmentId: departments[dept]._id,
        sectionId:
          role === "student"
            ? dept === "cse"
              ? section._id
              : otherSection._id
            : undefined,
        assignedSectionIds: role === "teacher" ? [section._id] : [],
        currentSemester: 1,
        currentYear: 1,
      });
      agents[key] = request.agent(app);
      const login = await agents[key]
        .post("/api/auth/login")
        .send({ identifier: users[key].email, password: "Test-password-123!" });
      assert.equal(login.status, 200, login.text);
      assert.equal(login.body.user.password, undefined);
    }
    for (const key of ["teacher", "sub1", "sub2"])
      teacherProfiles[key] = await Teacher.create({
        userId: users[key]._id,
        name: key,
        teacherId: key,
      });
    day = new Date();
    day.setUTCDate(day.getUTCDate() + ((8 - day.getUTCDay()) % 7 || 7));
    day = day.toISOString().slice(0, 10);
    const grid = Array.from({ length: 6 }, () => Array(9).fill(null));
    grid[0][0] = {
      teacherId: String(teacherProfiles.teacher._id),
      subjectName: "Mathematics",
    };
    grid[0][1] = {
      teacherId: String(teacherProfiles.teacher._id),
      subjectName: "Physics",
    };
    grid[1][3] = {
      teacherId: String(teacherProfiles.sub1._id),
      subjectName: "English",
    };
    grid[2][3] = {
      teacherId: String(teacherProfiles.sub2._id),
      subjectName: "Networks",
    };
    await Timetable.create({
      sectionId: section._id,
      semester: 1,
      classroom: "101",
      workingPeriod: { startDate: day, endDate: day.slice(0, 4) + "-12-31" },
      grid,
    });
  },
  { timeout: 180000 },
);
after(async () => {
  await mongoose.disconnect();
  if (db) await db.stop();
});
test("all module APIs require authentication and reject student mutations", async () => {
  for (const url of [
    "/api/timetable",
    "/api/notices",
    "/api/leaves/my",
    "/api/users",
  ])
    assert.equal((await request(app).get(url)).status, 401);
  assert.equal(
    (await agents.student.post("/api/timetable/generate").send({})).status,
    403,
  );
  assert.equal(
    (await agents.student.post("/api/notices").send({})).status,
    403,
  );
  assert.equal(
    (
      await agents.admin
        .post("/api/departments")
        .set("Origin", "https://evil.invalid")
        .send({ name: "Bad" })
    ).status,
    403,
  );
});
test("generated previews save through the unified API and feed the staff schedule", async () => {
  const Subject = require("../../../timetable/server/models/Subject");
  const extra = await Section.create({
    name: "CSE B",
    semester: 1,
    classroom: "201",
    departmentId: departments.cse._id,
  });
  await Subject.create({
    name: "Algorithms",
    code: "CS101",
    type: "theory",
    weeklySlots: 2,
    allowedTeachers: [teacherProfiles.sub1._id],
    sectionId: extra._id,
  });
  const payload = {
    sectionId: String(extra._id),
    workingPeriod: { startDate: day, endDate: day.slice(0, 4) + "-12-31" },
    variationSeed: 17,
    roomPool: [],
  };
  const preview = await agents.admin
    .post("/api/timetable/generate")
    .send(payload);
  assert.equal(preview.status, 200, preview.text);
  const saved = await agents.admin
    .post("/api/timetable/save")
    .send({ ...payload, grid: preview.body.timetable.grid });
  assert.equal(saved.status, 200, saved.text);
  const schedule = await agents.sub1.get("/api/schedule/my");
  assert.ok(
    schedule.body.days.some((d) =>
      d.periods.some((p) => p.subject === "Algorithms"),
    ),
  );
  const forbidden = await agents.otherHod
    .post("/api/timetable/generate")
    .send(payload);
  assert.equal(forbidden.status, 403);
  assert.equal(
    (await agents.admin.delete(`/api/timetable/${extra._id}`).send({})).status,
    200,
  );
});
test("one application covers all periods; races have one winner; department approval is enforced", async () => {
  const r = await agents.admin.post("/api/substitutes/request").send({
    teacherId: String(users.teacher._id),
    startDate: day,
    endDate: day,
    leaveType: "casual",
  });
  assert.equal(r.status, 201, r.text);
  leaveId = r.body.leave._id;
  requestIds = r.body.requests.map((x) => x._id);
  assert.equal(requestIds.length, 2);
  const duplicate = await agents.admin.post("/api/substitutes/request").send({
    teacherId: String(users.teacher._id),
    startDate: day,
    endDate: day,
    leaveType: "casual",
  });
  assert.equal(duplicate.body.leave._id, leaveId);
  assert.equal(
    (
      await agents.admin.patch(`/api/leaves/${leaveId}/details`).send({
        teacherId: String(users.teacher._id),
        reason: "Family commitment",
      })
    ).status,
    409,
  );
  const race = await Promise.all(
    ["sub1", "sub2"].map((k) =>
      agents.admin
        .patch(`/api/substitutes/${requestIds[0]}/accept`)
        .send({ teacherId: String(users[k]._id) }),
    ),
  );
  assert.deepEqual(race.map((x) => x.status).sort(), [200, 409]);
  const winner = race[0].status === 200 ? "sub1" : "sub2";
  assert.equal(
    (
      await agents.admin
        .patch(`/api/substitutes/${requestIds[1]}/accept`)
        .send({ teacherId: String(users[winner]._id) })
    ).status,
    200,
  );
  assert.equal(
    (await agents.admin.get(`/api/substitutes/my?teacherId=${users.sub1._id}`))
      .body.length,
    0,
  );
  assert.equal(
    (
      await agents.admin.patch(`/api/leaves/${leaveId}/details`).send({
        teacherId: String(users.teacher._id),
        reason: "Family commitment",
      })
    ).status,
    200,
  );
  assert.equal(
    (await agents.otherHod.patch(`/api/leaves/${leaveId}/approve`).send({}))
      .status,
    403,
  );
  assert.equal(
    (await agents.principal.patch(`/api/leaves/${leaveId}/approve`).send({}))
      .status,
    409,
  );
  assert.equal(
    (await agents.hod.patch(`/api/leaves/${leaveId}/approve`).send({})).status,
    200,
  );
  assert.equal(
    (await agents.principal.patch(`/api/leaves/${leaveId}/approve`).send({}))
      .status,
    200,
  );
  assert.equal(
    (await agents.principal.patch(`/api/leaves/${leaveId}/approve`).send({}))
      .status,
    409,
  );
  const bal = (await agents.teacher.get("/api/leaves/balance")).body;
  assert.equal(bal.firstHalfUsed + bal.secondHalfUsed, 1);
  assert.equal(
    (await agents.admin.delete(`/api/timetable/${section._id}`).send({}))
      .status,
    409,
  );
});
test("notice approval, audience isolation, and private attachments use shared identity", async () => {
  const upload = await agents.hod
    .post("/api/uploads/notices")
    .attach("file", Buffer.from("%PDF-1.4\n%%EOF"), "test.pdf");
  assert.equal(upload.status, 201, upload.text);
  const r = await agents.hod.post("/api/notices").send({
    title: "Midterm",
    description: "Prepare chapters 1 and 2.",
    scope: "SECTION",
    sectionId: String(section._id),
    type: "TEST",
    requestApproval: true,
    attachments: [upload.body],
  });
  assert.equal(r.status, 201, r.text);
  const id = r.body.notice._id;
  assert.equal((await agents.student.get("/api/notices")).body.length, 0);
  assert.equal(
    (
      await agents.otherHod
        .post(`/api/notices/${id}/approval`)
        .send({ action: "APPROVE" })
    ).status,
    403,
  );
  assert.equal(
    (
      await agents.principal
        .post(`/api/notices/${id}/approval`)
        .send({ action: "APPROVE" })
    ).status,
    200,
  );
  assert.equal((await agents.student.get("/api/notices")).body.length, 1);
  assert.equal((await agents.otherStudent.get("/api/notices")).body.length, 0);
  assert.equal((await agents.student.get(upload.body.url)).status, 200);
  assert.equal((await agents.otherStudent.get(upload.body.url)).status, 403);
  assert.equal(
    (
      await agents.otherStudent
        .post("/api/notifications/read")
        .send({ noticeId: id })
    ).status,
    404,
  );
  assert.equal(
    (
      await agents.student
        .post("/api/notifications/read")
        .send({ noticeId: id })
    ).status,
    200,
  );
  assert.equal(
    (await agents.student.get("/api/notifications")).body[0].isRead,
    true,
  );
});
test("pending activation consumes OTP once, and logout revokes the cookie session", async () => {
  const created = await agents.admin.post("/api/users").send({
    name: "New staff",
    email: "new@test.invalid",
    role: "teacher",
    departmentId: String(departments.cse._id),
  });
  assert.equal(created.status, 201, created.text);
  const id = created.body.user._id;
  await Activation.create({
    userId: id,
    hash: crypto
      .createHmac("sha256", process.env.OTP_SECRET)
      .update(`${id}:123456`)
      .digest("hex"),
    expiresAt: new Date(Date.now() + 60000),
  });
  const body = {
    identifier: "new@test.invalid",
    otp: "123456",
    newPassword: "New-staff-password!",
  };
  assert.equal(
    (await request(app).post("/api/auth/activation/verify").send(body)).status,
    200,
  );
  assert.equal(
    (await request(app).post("/api/auth/activation/verify").send(body)).status,
    400,
  );
  const a = request.agent(app);
  const login = await a
    .post("/api/auth/login")
    .send({ identifier: body.identifier, password: body.newPassword });
  assert.equal(login.status, 200);
  const cookie = login.headers["set-cookie"][0].split(";")[0];
  assert.equal((await a.post("/api/auth/logout").send({})).status, 200);
  assert.equal(
    (await request(app).get("/api/auth/me").set("Cookie", cookie)).status,
    401,
  );
});
test("frozen users lose access across modules immediately", async () => {
  await User.updateOne(
    { _id: users.otherStudent._id },
    { $set: { status: "FROZEN" } },
  );
  assert.equal((await agents.otherStudent.get("/api/notices")).status, 401);
});

test("teachers and class teachers have read-only campus access, including direct API calls", async () => {
  for (const role of ["teacher", "classTeacher", "student"]) {
    for (const [method, url] of [
      ["post", "/api/users"],
      ["post", "/api/departments"],
      ["post", "/api/sections"],
      ["post", "/api/subjects"],
      ["post", "/api/teachers"],
      ["post", "/api/notices"],
      ["post", "/api/uploads/notices"],
      ["patch", `/api/substitutes/${requestIds[0]}/accept`],
      ["patch", `/api/substitutes/${requestIds[0]}/decline`],
      ["patch", `/api/leaves/${leaveId}/reject`],
      ["patch", `/api/leaves/${leaveId}/approve`],
      ["patch", `/api/notices/${new mongoose.Types.ObjectId()}`],
      ["post", "/api/academic-cycle/advance"],
    ]) {
      const r = await agents[role][method](url).send({});
      assert.equal(r.status, 403, `${role} ${url}: ${r.text}`);
    }
    assert.equal((await agents[role].get("/api/users")).status, 403);
    assert.equal((await agents[role].get("/api/schedule/my")).status, 200);
  }
  assert.equal(
    (await agents.teacher.get(`/api/leaves/my?teacherId=${users.sub1._id}`))
      .status,
    403,
  );
  assert.equal(
    (await agents.otherHod.get(`/api/leaves/my?teacherId=${users.teacher._id}`))
      .status,
    403,
  );
  assert.equal(
    (await agents.hod.get(`/api/leaves/my?teacherId=${users.teacher._id}`))
      .status,
    200,
  );
});
test("account requests require admin approval before OTP activation and cannot request privileged roles", async () => {
  const body = {
    name: "Applicant",
    email: "applicant@test.invalid",
    role: "student",
    departmentId: String(departments.cse._id),
    sectionId: String(section._id),
    currentSemester: 1,
    status: "ACTIVE",
    password: "Attacker-supplied-password",
  };
  assert.equal(
    (
      await request(app)
        .post("/api/auth/registration/request")
        .send({ ...body, role: "admin" })
    ).status,
    400,
  );
  assert.equal(
    (
      await request(app)
        .post("/api/auth/registration/request")
        .send({ ...body, currentSemester: 2 })
    ).status,
    400,
  );
  const r = await request(app)
    .post("/api/auth/registration/request")
    .send(body);
  assert.equal(r.status, 202, r.text);
  const applicant = await User.findOne({ email: body.email });
  assert.equal(applicant.status, "REQUESTED");
  assert.equal(
    (
      await request(app)
        .post("/api/auth/login")
        .send({ identifier: body.email, password: body.password })
    ).status,
    401,
  );
  await request(app)
    .post("/api/auth/activation/request")
    .send({ identifier: body.email });
  assert.equal(await Activation.countDocuments({ userId: applicant._id }), 0);
  assert.equal(
    (
      await agents.admin
        .patch(`/api/users/${applicant._id}/status`)
        .send({ status: "ACTIVE" })
    ).status,
    400,
  );
  for (const role of ["hod", "principal", "teacher"])
    assert.equal(
      (
        await agents[role]
          .post(`/api/users/${applicant._id}/review`)
          .send({ action: "APPROVE" })
      ).status,
      403,
    );
  const race = await Promise.all(
    [1, 2].map(() =>
      agents.admin
        .post(`/api/users/${applicant._id}/review`)
        .send({ action: "APPROVE" }),
    ),
  );
  assert.deepEqual(race.map((r) => r.status).sort(), [200, 409]);
  assert.equal((await User.findById(applicant._id)).status, "PENDING");
  await Activation.create({
    userId: applicant._id,
    hash: crypto
      .createHmac("sha256", process.env.OTP_SECRET)
      .update(`${applicant._id}:123456`)
      .digest("hex"),
    expiresAt: new Date(Date.now() + 60000),
  });
  const activated = await request(app)
    .post("/api/auth/activation/verify")
    .send({
      identifier: body.email,
      otp: "123456",
      newPassword: "Applicant-new-password!",
    });
  assert.equal(activated.status, 200, activated.text);
  assert.equal(
    (
      await request(app)
        .post("/api/auth/login")
        .send({ identifier: body.email, password: "Applicant-new-password!" })
    ).status,
    200,
  );
  const options = await request(app).get("/api/auth/registration/options");
  assert.equal(options.status, 200);
  assert.ok(options.body.sections.some((s) => s._id === String(section._id)));
});
test("rejected requests cannot activate or be silently reapproved", async () => {
  const body = {
    name: "Rejected applicant",
    email: "rejected@test.invalid",
    role: "teacher",
    departmentId: String(departments.cse._id),
  };
  assert.equal(
    (await request(app).post("/api/auth/registration/request").send(body))
      .status,
    202,
  );
  const user = await User.findOne({ email: body.email });
  assert.equal(
    (
      await agents.admin
        .post(`/api/users/${user._id}/review`)
        .send({ action: "REJECT", reason: "Not on staff register" })
    ).status,
    200,
  );
  assert.equal(
    (
      await agents.admin
        .post(`/api/users/${user._id}/review`)
        .send({ action: "APPROVE" })
    ).status,
    409,
  );
  assert.equal(
    (
      await agents.admin
        .patch(`/api/users/${user._id}/status`)
        .send({ status: "ACTIVE" })
    ).status,
    400,
  );
  await request(app)
    .post("/api/auth/activation/request")
    .send({ identifier: body.email });
  assert.equal(await Activation.countDocuments({ userId: user._id }), 0);
});
test("department and section setup populates options, enforces HOD scope and semester consistency", async () => {
  const dept = await agents.admin
    .post("/api/departments")
    .send({ name: "Mechanical" });
  assert.equal(dept.status, 201, dept.text);
  const created = await agents.admin.post("/api/sections").send({
    name: "ME A",
    departmentId: dept.body._id,
    semester: 3,
    classroom: "303",
  });
  assert.equal(created.status, 201, created.text);
  const id = created.body._id;
  assert.ok(
    (await agents.admin.get("/api/sections")).body.some((s) => s._id === id),
  );
  assert.equal(
    (
      await agents.hod
        .put(`/api/sections/${id}`)
        .send({ ...created.body, name: "Forbidden" })
    ).status,
    403,
  );
  assert.equal(
    (
      await agents.hod.post("/api/sections").send({
        name: "Outside",
        departmentId: dept.body._id,
        semester: 3,
        classroom: "303",
      })
    ).status,
    403,
  );
  const own = await agents.hod.post("/api/sections").send({
    name: "CSE C",
    departmentId: String(departments.cse._id),
    semester: 3,
    classroom: "305",
  });
  assert.equal(own.status, 201, own.text);
  assert.equal(
    (await agents.hod.get("/api/sections")).body.some((s) => s._id === id),
    false,
  );
  const mismatch = await agents.admin.post("/api/users").send({
    name: "Wrong semester",
    email: "wrong-sem@test.invalid",
    role: "student",
    departmentId: dept.body._id,
    sectionId: id,
    currentSemester: 1,
  });
  assert.equal(mismatch.status, 400);
  assert.equal(
    (
      await agents.admin
        .put(`/api/sections/${id}`)
        .send({ ...created.body, name: "ME B" })
    ).status,
    200,
  );
  assert.equal(
    (await agents.admin.delete(`/api/departments/${dept.body._id}`).send({}))
      .status,
    409,
  );
  assert.equal(
    (await agents.admin.delete(`/api/sections/${id}`).send({})).status,
    200,
  );
  assert.equal(
    (await agents.admin.delete(`/api/departments/${dept.body._id}`).send({}))
      .status,
    200,
  );
  assert.equal(
    (await agents.hod.delete(`/api/sections/${own.body._id}`).send({})).status,
    200,
  );
});

test("account removal enforces authority, confirmation, and Super Admin protection", async () => {
  const pending = await User.create({
    name: "Disposable",
    email: "remove@test.invalid",
    password: "unused",
    role: "student",
    status: "PENDING",
  });
  for (const actor of ["student", "teacher", "hod", "principal"])
    assert.equal(
      (
        await agents[actor]
          .delete(`/api/users/${pending._id}`)
          .send({ confirmEmail: pending.email })
      ).status,
      403,
    );
  assert.equal(
    (
      await agents.admin
        .delete(`/api/users/${users.admin._id}`)
        .send({ confirmEmail: users.admin.email })
    ).status,
    403,
  );
  assert.equal(
    (await agents.admin.post(`/api/users/${users.admin._id}/archive`).send({}))
      .status,
    403,
  );
  assert.equal(
    (
      await agents.admin
        .delete(`/api/users/${pending._id}`)
        .send({ confirmEmail: "wrong" })
    ).status,
    400,
  );
  await Activation.create({
    userId: pending._id,
    hash: "code",
    expiresAt: new Date(Date.now() + 60000),
  });
  await Session.create({
    userId: pending._id,
    hash: "temporary-session",
    expiresAt: new Date(Date.now() + 60000),
  });
  assert.equal(
    (
      await agents.admin
        .delete(`/api/users/${pending._id}`)
        .send({ confirmEmail: pending.email })
    ).status,
    200,
  );
  assert.equal(await User.findById(pending._id), null);
  assert.equal(await Activation.countDocuments({ userId: pending._id }), 0);
  assert.equal(await Session.countDocuments({ userId: pending._id }), 0);
  assert.equal(
    (
      await agents.admin
        .delete(`/api/users/${pending._id}`)
        .send({ confirmEmail: pending.email })
    ).status,
    404,
  );
});

test("archive revokes access and deletion preserves linked campus history", async () => {
  const account = await User.create({
    name: "Archive example",
    email: "archive@test.invalid",
    password: await bcrypt.hash("Test-password-123!", 4),
    role: "teacher",
    status: "ACTIVE",
  });
  const agent = request.agent(app);
  assert.equal(
    (
      await agent
        .post("/api/auth/login")
        .send({ identifier: account.email, password: "Test-password-123!" })
    ).status,
    200,
  );
  assert.equal(
    (
      await agents.admin
        .delete(`/api/users/${account._id}`)
        .send({ confirmEmail: account.email })
    ).status,
    409,
  );
  await Teacher.create({
    userId: account._id,
    name: "Archive example",
    teacherId: "archive-example",
  });
  assert.equal(
    (await agents.admin.post(`/api/users/${account._id}/archive`).send({}))
      .status,
    200,
  );
  assert.equal((await User.findById(account._id)).status, "TERMINATED");
  assert.equal(await Session.countDocuments({ userId: account._id }), 0);
  assert.equal((await agent.get("/api/auth/me")).status, 401);
  const blocked = await agents.admin
    .delete(`/api/users/${account._id}`)
    .send({ confirmEmail: account.email });
  assert.equal(blocked.status, 409, blocked.text);
  assert.match(blocked.body.message, /linked Teacher/);
  assert.ok(await User.findById(account._id));
  await Teacher.deleteOne({ userId: account._id });
  assert.equal(
    (
      await agents.admin
        .delete(`/api/users/${account._id}`)
        .send({ confirmEmail: account.email })
    ).status,
    200,
  );
});

test("unrelated departments and sections save alongside existing timetables during active leave", async () => {
  const Subject = require("../../../timetable/server/models/Subject");
  const beforeTables = await Timetable.find().lean();
  const teacher = await User.create({
    name: "Independent teacher",
    email: "independent@test.invalid",
    password: "unused",
    role: "teacher",
    status: "ACTIVE",
    departmentId: departments.ece._id,
  });
  const profile = await Teacher.create({
    name: teacher.name,
    teacherId: "independent",
    userId: teacher._id,
  });
  for (const n of [1, 2]) {
    const extra = await Section.create({
      name: `ECE new ${n}`,
      classroom: `independent-${n}`,
      semester: 1,
      departmentId: departments.ece._id,
    });
    await Subject.create({
      name: `Electronics ${n}`,
      code: `ECNEW${n}`,
      type: "theory",
      weeklySlots: 2,
      allowedTeachers: [profile._id],
      sectionId: extra._id,
    });
    const payload = {
      sectionId: String(extra._id),
      workingPeriod: { startDate: day, endDate: day.slice(0, 4) + "-12-31" },
      variationSeed: 23,
      roomPool: [],
    };
    const preview = await agents.otherHod
      .post("/api/timetable/generate")
      .send(payload);
    assert.equal(preview.status, 200, preview.text);
    const saved = await agents.otherHod
      .post("/api/timetable/save")
      .send({ ...payload, grid: preview.body.timetable.grid });
    assert.equal(saved.status, 200, saved.text);
    const edited = await agents.otherHod
      .post("/api/timetable/save-edited")
      .send({ ...payload, grid: saved.body.timetable.grid });
    assert.equal(edited.status, 200, edited.text);
  }
  assert.equal(await Timetable.countDocuments(), beforeTables.length + 2);
  for (const original of beforeTables)
    assert.deepEqual(await Timetable.findById(original._id).lean(), original);
});

test("schedule dependency locks include absent staff, substitutes and old schedules but exclude nonoverlapping dates", async () => {
  const {
    assertScheduleChangeAllowed,
  } = require("../../services/scheduleDependencies");
  const arbitrarySection = new mongoose.Types.ObjectId();
  const grid = Array.from({ length: 6 }, () => Array(9).fill(null));
  const assignment =
    await require("../../../leave-management/backend/models/SubstituteRequest").findById(
      requestIds[0],
    );
  const substitute = await Teacher.findOne({
    userId: assignment.substituteTeacher,
  });
  for (const profile of [teacherProfiles.teacher, substitute]) {
    grid[0][0] = { teacherId: String(profile._id) };
    await assert.rejects(
      () =>
        assertScheduleChangeAllowed(arbitrarySection, {
          grid,
          workingPeriod: { startDate: day, endDate: day },
        }),
      /overlapping active leave/,
    );
  }
  // An empty replacement cannot bypass dependencies on the existing grid.
  await assert.rejects(
    () =>
      assertScheduleChangeAllowed(section._id, {
        grid: [],
        workingPeriod: { startDate: "2035-01-01", endDate: "2035-12-31" },
      }),
    /overlapping active leave/,
  );
  await assertScheduleChangeAllowed(arbitrarySection, {
    grid,
    workingPeriod: { startDate: "2035-01-01", endDate: "2035-12-31" },
  });
});

test("management can reject a pending coverage appeal; personal decline does not reject everyone", async () => {
  const Leave = require("../../../leave-management/backend/models/Leave");
  const Request = require("../../../leave-management/backend/models/SubstituteRequest");
  const next = new Date(day);
  next.setUTCDate(next.getUTCDate() + 7);
  const date = next.toISOString().slice(0, 10);
  const created = await agents.admin.post("/api/substitutes/request").send({
    teacherId: String(users.teacher._id),
    startDate: date,
    endDate: date,
    leaveType: "casual",
  });
  assert.equal(created.status, 201, created.text);
  const id = created.body.leave._id;
  const rid = created.body.requests[0]._id;
  assert.equal(
    (
      await agents.admin
        .patch(`/api/substitutes/${rid}/decline`)
        .send({ teacherId: String(users.sub1._id) })
    ).status,
    200,
  );
  assert.equal((await Leave.findById(id)).status, "coverage_pending");
  assert.equal(
    (
      await agents.otherHod
        .patch(`/api/leaves/${id}/reject`)
        .send({ reason: "Wrong scope" })
    ).status,
    403,
  );
  assert.equal(
    (
      await agents.teacher
        .patch(`/api/leaves/${id}/reject`)
        .send({ reason: "No authority" })
    ).status,
    403,
  );
  assert.equal(
    (await agents.hod.patch(`/api/leaves/${id}/reject`).send({ reason: "" }))
      .status,
    400,
  );
  const rejected = await agents.hod
    .patch(`/api/leaves/${id}/reject`)
    .send({ reason: "Appeal withdrawn before submission" });
  assert.equal(rejected.status, 200, rejected.text);
  assert.equal((await Leave.findById(id)).status, "rejected");
  assert.equal(
    await Request.countDocuments({ leave: id, status: "cancelled" }),
    created.body.requests.length,
  );
  assert.ok(
    (await agents.teacher.get("/api/leaves/my")).body.some(
      (l) => l._id === id && l.status === "rejected",
    ),
  );
  assert.ok(
    (await agents.admin.get("/api/leaves/all")).body.some(
      (l) =>
        l._id === id &&
        l.rejectionReason === "Appeal withdrawn before submission",
    ),
  );
  assert.equal(
    (
      await agents.admin
        .patch(`/api/substitutes/${rid}/accept`)
        .send({ teacherId: String(users.sub2._id) })
    ).status,
    409,
  );
  assert.equal(
    (
      await agents.admin
        .patch(`/api/leaves/${leaveId}/reject`)
        .send({ reason: "Cannot reverse final approval" })
    ).status,
    409,
  );
  const grid = Array.from({ length: 6 }, () => Array(9).fill(null));
  grid[0][0] = { teacherId: String(teacherProfiles.teacher._id) };
  await require("../../services/scheduleDependencies").assertScheduleChangeAllowed(
    new mongoose.Types.ObjectId(),
    { grid, workingPeriod: { startDate: date, endDate: date } },
  );
});

test("submitted rejection cancels accepted assignments, keeps history and releases substitute slots", async () => {
  const Request = require("../../../leave-management/backend/models/SubstituteRequest");
  const next = new Date(day);
  next.setUTCDate(next.getUTCDate() + 14);
  const date = next.toISOString().slice(0, 10);
  const created = await agents.admin.post("/api/substitutes/request").send({
    teacherId: String(users.teacher._id),
    startDate: date,
    endDate: date,
    leaveType: "casual",
  });
  assert.equal(created.status, 201, created.text);
  const id = created.body.leave._id;
  for (const r of created.body.requests) {
    const accepted = await agents.admin
      .patch(`/api/substitutes/${r._id}/accept`)
      .send({ teacherId: String(users.sub1._id) });
    assert.equal(accepted.status, 200, accepted.text);
  }
  assert.equal(
    (
      await agents.admin.patch(`/api/leaves/${id}/details`).send({
        teacherId: String(users.teacher._id),
        reason: "Personal leave",
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await agents.principal
        .patch(`/api/leaves/${id}/reject`)
        .send({ reason: "Out of order" })
    ).status,
    409,
  );
  assert.equal(
    (
      await agents.hod
        .patch(`/api/leaves/${id}/reject`)
        .send({ reason: "Not approved" })
    ).status,
    200,
  );
  assert.equal(
    await Request.countDocuments({ leave: id, status: "cancelled" }),
    created.body.requests.length,
  );
  const covers = await agents.admin.get(
    `/api/substitutes/accepted?teacherId=${users.sub1._id}`,
  );
  assert.ok(!covers.body.some((r) => r.leave === id));
  assert.ok(
    !(await agents.admin.get("/api/leaves/review")).body.some(
      (l) => l._id === id,
    ),
  );
});

test("teachers and class teachers may appeal and submit only their own leave, with management-only coverage", async () => {
  const classProfile = await Teacher.create({
    name: "Class teacher",
    teacherId: "class-teacher",
    userId: users.classTeacher._id,
  });
  const ownSection = await Section.create({
    name: "Class teacher section",
    semester: 1,
    classroom: "class-teacher-room",
    departmentId: departments.cse._id,
  });
  const grid = Array.from({ length: 6 }, () => Array(9).fill(null));
  grid[0][0] = {
    teacherId: String(classProfile._id),
    subjectName: "Class teacher lesson",
  };
  grid[0][1] = {
    teacherId: String(teacherProfiles.sub1._id),
    subjectName: "Substitute lesson",
  };
  await Timetable.create({
    sectionId: ownSection._id,
    semester: 1,
    classroom: ownSection.classroom,
    workingPeriod: { startDate: day, endDate: "2035-12-31" },
    grid,
  });
  for (const [index, actor] of ["teacher", "classTeacher"].entries()) {
    const next = new Date(day);
    next.setUTCDate(next.getUTCDate() + 21 + index * 7);
    const date = next.toISOString().slice(0, 10);
    const body = { startDate: date, endDate: date, leaveType: "sick" };
    assert.equal(
      (
        await agents[actor]
          .post("/api/substitutes/request")
          .send({ ...body, teacherId: String(users.sub2._id) })
      ).status,
      403,
    );
    assert.equal(
      (
        await agents[actor]
          .post(`/api/substitutes/request?teacherId=${users.sub2._id}`)
          .send(body)
      ).status,
      403,
    );
    const created = await agents[actor]
      .post("/api/substitutes/request")
      .send(body);
    assert.equal(created.status, 201, created.text);
    assert.equal(created.body.leave.teacher, String(users[actor]._id));
    const id = created.body.leave._id;
    assert.equal(
      (
        await agents[actor]
          .patch(`/api/leaves/${id}/details`)
          .send({ reason: "Sick leave" })
      ).status,
      409,
    );
    assert.equal(
      (
        await agents[actor]
          .patch(`/api/leaves/${leaveId}/details`)
          .send({ teacherId: String(users.sub2._id), reason: "Other person" })
      ).status,
      403,
    );
    for (const url of [
      "/api/leaves/all",
      "/api/leaves/review",
      "/api/substitutes/my",
      "/api/substitutes/accepted",
    ])
      assert.equal((await agents[actor].get(url)).status, 403);
    for (const action of ["accept", "decline"])
      assert.equal(
        (
          await agents[actor]
            .patch(`/api/substitutes/${created.body.requests[0]._id}/${action}`)
            .send({})
        ).status,
        403,
      );
    for (const action of ["approve", "reject"])
      assert.equal(
        (
          await agents[actor]
            .patch(`/api/leaves/${id}/${action}`)
            .send({ reason: "Attempt" })
        ).status,
        403,
      );
    // Management still arranges all coverage on behalf of the substitute.
    // sub2 teaches the original section; sub1 teaches the class-teacher section.
    const substitute = actor === "teacher" ? users.sub2 : users.sub1;
    for (const r of created.body.requests) {
      const accepted = await agents.admin
        .patch(`/api/substitutes/${r._id}/accept`)
        .send({ teacherId: String(substitute._id) });
      assert.equal(accepted.status, 200, accepted.text);
    }
    const submitted = await agents[actor]
      .patch(`/api/leaves/${id}/details`)
      .send({ reason: "Sick leave" });
    assert.equal(submitted.status, 200, submitted.text);
    assert.equal(submitted.body.status, "submitted");
    const records = await agents[actor].get("/api/leaves/my");
    assert.ok(
      records.body.some((l) => l._id === id && l.status === "submitted"),
    );
    assert.ok(
      records.body.every((l) => l.teacher._id === String(users[actor]._id)),
    );
    assert.equal(
      (
        await agents.hod
          .patch(`/api/leaves/${id}/reject`)
          .send({ reason: "Reviewed" })
      ).status,
      200,
    );
    assert.ok(
      (await agents[actor].get("/api/leaves/my")).body.some(
        (l) => l._id === id && l.status === "rejected",
      ),
    );
  }
  assert.equal(
    (await agents.student.post("/api/substitutes/request").send({})).status,
    403,
  );
  assert.equal(
    (
      await agents.student
        .patch(`/api/leaves/${leaveId}/details`)
        .send({ reason: "Not allowed" })
    ).status,
    403,
  );
  assert.equal(
    (
      await agents.classTeacher
        .patch(`/api/leaves/${leaveId}/details`)
        .send({ reason: "Someone else's leave" })
    ).status,
    404,
  );
});
