const { test } = require("node:test");
const assert = require("node:assert/strict");
const { canCreate, noticeQuery } = require("../lib/policy");
const { project } = require("../services/timetableSource");
test("department hierarchy cannot create equal roles or users outside its scope", () => {
  const actor = { role: "hod", departmentId: "cse" };
  assert.equal(canCreate(actor, "hod", "cse"), false);
  assert.equal(canCreate(actor, "teacher", "ece"), false);
  assert.equal(canCreate(actor, "teacher", "cse"), true);
  assert.equal(
    canCreate(
      { ...actor, role: "class_teacher", assignedSectionIds: ["A"] },
      "student",
      "cse",
      "B",
    ),
    false,
  );
});
test("unassigned staff never receive null department notices", () => {
  const q = noticeQuery({ role: "teacher", assignedSectionIds: [] });
  assert.deepEqual(q.$and[1].$or, [{ scope: "COLLEGE" }]);
  assert.deepEqual(q.approvalStatus, { $in: ["NOT_REQUIRED", "APPROVED"] });
});
test("saved timetable projects each lab slot with the real campus times and date boundaries", () => {
  const grid = Array.from({ length: 6 }, () => Array(9).fill(null));
  grid[0][6] = { teacherId: "t1", subjectName: "Networks lab" };
  grid[0][7] = { teacherId: "t1", subjectName: "Networks lab" };
  const tt = project(
    [
      {
        grid,
        sectionId: { _id: "s1", name: "CSE A" },
        workingPeriod: { startDate: "2027-01-01", endDate: "2027-05-31" },
      },
    ],
    "t1",
  );
  assert.equal(tt.days[0].periods.length, 2);
  assert.equal(tt.days[0].periods[0].startTime, "13:20");
  assert.equal(tt.days[0].periods[1].periodNumber, 8);
  assert.equal(tt.days[0].periods[0].validTo, "2027-05-31");
  assert.equal(project([{ grid }], "other").days[0].periods.length, 0);
});

test("class teachers cannot create student accounts even in an assigned section", () => {
  assert.equal(
    canCreate(
      { role: "class_teacher", departmentId: "cse", assignedSectionIds: ["A"] },
      "student",
      "cse",
      "A",
    ),
    false,
  );
});
