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
  const r = await agents.teacher
    .post("/api/substitutes/request")
    .send({ startDate: day, endDate: day, leaveType: "casual" });
  assert.equal(r.status, 201, r.text);
  leaveId = r.body.leave._id;
  requestIds = r.body.requests.map((x) => x._id);
  assert.equal(requestIds.length, 2);
  const duplicate = await agents.teacher
    .post("/api/substitutes/request")
    .send({ startDate: day, endDate: day, leaveType: "casual" });
  assert.equal(duplicate.body.leave._id, leaveId);
  assert.equal(
    (
      await agents.teacher
        .patch(`/api/leaves/${leaveId}/details`)
        .send({ reason: "Family commitment" })
    ).status,
    409,
  );
  const race = await Promise.all(
    ["sub1", "sub2"].map((k) =>
      agents[k].patch(`/api/substitutes/${requestIds[0]}/accept`).send({}),
    ),
  );
  assert.deepEqual(race.map((x) => x.status).sort(), [200, 409]);
  const winner = race[0].status === 200 ? "sub1" : "sub2";
  assert.equal(
    (
      await agents[winner]
        .patch(`/api/substitutes/${requestIds[1]}/accept`)
        .send({})
    ).status,
    200,
  );
  assert.equal((await agents.sub1.get("/api/substitutes/my")).body.length, 0);
  assert.equal(
    (
      await agents.teacher
        .patch(`/api/leaves/${leaveId}/details`)
        .send({ reason: "Family commitment" })
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
  const upload = await agents.teacher
    .post("/api/uploads/notices")
    .attach("file", Buffer.from("%PDF-1.4\n%%EOF"), "test.pdf");
  assert.equal(upload.status, 201, upload.text);
  const r = await agents.teacher.post("/api/notices").send({
    title: "Midterm",
    description: "Prepare chapters 1 and 2.",
    scope: "SECTION",
    sectionId: String(section._id),
    type: "TEST",
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
      await agents.hod
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
