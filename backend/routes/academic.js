const router = require("express").Router();
const User = require("../models/User");
const Teacher = require("../../timetable/server/models/Teacher");
const Section = require("../../timetable/server/models/Section");
const Subject = require("../../timetable/server/models/Subject");
const Department = require("../../timetable/server/models/Department");
const Timetable = require("../../timetable/server/models/Timetable");
const Leave = require("../../leave-management/backend/models/Leave");
const { authorize } = require("../lib/auth");
const { managers, staff, fail, same } = require("../lib/policy");
const { transaction, transactional } = require("../lib/transaction");
const source = require("../services/timetableSource");
const W = require("../../leave-management/backend/services/leaveWorkflow");
const C = require("../../timetable/server/controllers/timetableController");
W.configure({ timetableSource: source, transaction });
const manage = authorize(...managers);
const scheduling = authorize(...managers, "hod");
function scope(req, departmentId) {
  if (req.user.role === "hod" && !same(req.user.departmentId, departmentId))
    fail("This record is outside your department.", 403);
}
const sectionFilter = (req) =>
  req.user.role === "hod"
    ? { departmentId: req.user.departmentId || null }
    : {};
async function teacherScope(req, teacher) {
  if (req.user.role !== "hod") return;
  const user = teacher?.userId && (await User.findById(teacher.userId));
  if (!user) fail("An administrator must link this teacher first.", 403);
  scope(req, user.departmentId);
}
router.get("/departments", async (req, res) =>
  res.json(
    await Department.find(
      req.user.role === "hod" ? { _id: req.user.departmentId } : {},
    ).sort({ name: 1 }),
  ),
);
router.post("/departments", manage, async (req, res) => {
  if (typeof req.body.name !== "string" || !req.body.name.trim())
    fail("Department name is required.");
  res.status(201).json(await Department.create({ name: req.body.name.trim() }));
});
router.get("/sections", async (req, res) =>
  res.json(
    await Section.find(sectionFilter(req)).sort({ semester: 1, name: 1 }),
  ),
);
for (const [method, path, fn] of [
  ["post", "/sections", "createSection"],
  ["put", "/sections/:id", "updateSection"],
  ["delete", "/sections/:id", "deleteSection"],
  ["post", "/subjects", "createSubject"],
  ["put", "/subjects/:id", "updateSubject"],
  ["delete", "/subjects/:id", "deleteSubject"],
]) {
  const type = path.includes("sections") ? "section" : "subject";
  router[method](
    path,
    scheduling,
    transactional(async (req, res) => {
      const record =
        method !== "post"
          ? await (type === "section" ? Section : Subject).findById(
              req.params.id,
            )
          : null;
      if (method !== "post" && !record) fail("Record not found.", 404);
      if (record) {
        const originalSection =
          type === "section"
            ? record
            : await Section.findById(record.sectionId);
        scope(req, originalSection?.departmentId);
      }
      if (method !== "delete") {
        if (type === "section") {
          scope(req, req.body.departmentId);
          if (
            !Number.isInteger(Number(req.body.semester)) ||
            Number(req.body.semester) < 1 ||
            Number(req.body.semester) > 8
          )
            fail("Semester must be an integer from 1 to 8.");
          if (
            record &&
            (!same(record.departmentId, req.body.departmentId) ||
              record.semester !== Number(req.body.semester)) &&
            (await User.exists({
              $or: [
                { sectionId: record._id },
                { assignedSectionIds: record._id },
              ],
            }))
          )
            fail(
              "Reassign linked users before changing a section's department or semester.",
              409,
            );
          req.body = {
            name: req.body.name,
            semester: req.body.semester,
            classroom: req.body.classroom,
            departmentId: req.body.departmentId,
          };
        } else {
          const target = await Section.findById(req.body.sectionId);
          if (!target) fail("Choose an existing section.");
          scope(req, target.departmentId);
        }
      }
      const sectionId =
        type === "section"
          ? record?._id
          : req.body.sectionId || record?.sectionId;
      if (
        (sectionId && (await Timetable.exists({ sectionId }))) ||
        (record?.sectionId &&
          (await Timetable.exists({ sectionId: record.sectionId })))
      )
        fail(
          "Remove this section’s saved timetable before changing its catalogue.",
          409,
        );
      if (
        type === "section" &&
        method !== "delete" &&
        (!req.body.departmentId ||
          !(await Department.exists({ _id: req.body.departmentId })))
      )
        fail("Select an existing department.");
      if (
        type === "section" &&
        method === "delete" &&
        ((await Subject.exists({ sectionId: req.params.id })) ||
          (await User.exists({
            $or: [
              { sectionId: req.params.id },
              { assignedSectionIds: req.params.id },
            ],
          })))
      )
        fail("Section is still referenced by subjects or users.", 409);
      if (type === "subject" && method !== "delete") {
        if (!(await Section.exists({ _id: req.body.sectionId })))
          fail("Select an existing section.");
        const ids = [
          ...(req.body.allowedTeachers || []),
          ...(req.body.batchAssignments || []).flatMap(
            (b) => b.allowedTeachers || [],
          ),
        ];
        if (
          (await Teacher.countDocuments({ _id: { $in: ids } })) !==
          new Set(ids).size
        )
          fail("Select existing teachers.");
      }
      await require(`../../timetable/server/controllers/${type}Controller`)[fn](
        req,
        res,
      );
    }),
  );
}
router.get("/subjects", async (req, res) => {
  const allowed = await Section.find(sectionFilter(req)).select("_id");
  return res.json(
    await Subject.find({
      sectionId: {
        $in: allowed
          .filter(
            (s) => !req.query.sectionId || same(s._id, req.query.sectionId),
          )
          .map((s) => s._id),
      },
    })
      .populate("allowedTeachers")
      .populate("batchAssignments.allowedTeachers")
      .populate("sectionId"),
  );
});
router.get("/teachers", async (req, res) =>
  res.json(
    await Teacher.find(
      req.user.role === "hod"
        ? {
            userId: {
              $in: (
                await User.find({ departmentId: req.user.departmentId }).select(
                  "_id",
                )
              ).map((u) => u._id),
            },
          }
        : {},
    ).populate("subjects"),
  ),
);
router.post(
  "/teachers",
  scheduling,
  transactional(async (req, res) => {
    const user = await User.findById(req.body.userId);
    if (!user || !staff.includes(user.role))
      fail("Select an existing staff account.");
    scope(req, user.departmentId);
    res.status(201).json(
      await Teacher.create({
        userId: user._id,
        name: user.name,
        email: user.email,
        teacherId: user.usn || String(user._id),
        maxSessionsPerDay: req.body.maxSessionsPerDay || 3,
      }),
    );
  }),
);
router.put(
  "/teachers/:id",
  scheduling,
  transactional(async (req, res) => {
    if (await Leave.exists({ status: { $in: W.ACTIVE } }))
      fail("Staff mapping is locked while active leave workflows exist.", 409);
    if (
      (req.body.maxSessionsPerDay !== undefined ||
        req.body.unavailableSlots !== undefined) &&
      (await Timetable.exists({}))
    )
      fail("Remove saved schedules before changing teacher constraints.", 409);
    const teacher = await Teacher.findById(req.params.id);
    if (!teacher) fail("Teacher not found.", 404);
    await teacherScope(req, teacher);
    if (req.body.userId) {
      const user = await User.findById(req.body.userId);
      if (!user || !staff.includes(user.role))
        fail("Select an existing staff account.");
      scope(req, user.departmentId);
      teacher.userId = user._id;
      teacher.name = user.name;
      teacher.email = user.email;
    }
    if (req.body.maxSessionsPerDay !== undefined)
      teacher.maxSessionsPerDay = req.body.maxSessionsPerDay;
    if (req.body.unavailableSlots !== undefined)
      teacher.unavailableSlots = req.body.unavailableSlots;
    await teacher.save();
    res.json(teacher);
  }),
);
router.delete(
  "/timetable/:sectionId",
  scheduling,
  transactional(async (req, res) => {
    if (
      await Leave.exists({
        status: { $in: W.ACTIVE },
        endDate: { $gte: new Date(new Date().toISOString().slice(0, 10)) },
      })
    )
      fail(
        "Current or future leave workflows depend on the saved schedule.",
        409,
      );
    const section = await Section.findById(req.params.sectionId);
    if (!section) fail("Section not found.", 404);
    scope(req, section.departmentId);
    await Timetable.deleteOne({ sectionId: req.params.sectionId });
    res.json({
      message: "Saved timetable removed. You can now edit its catalogue.",
    });
  }),
);
router.get("/schedule/my", async (req, res) => {
  if (req.user.role === "student") {
    res.json(
      await Timetable.find({ sectionId: req.user.sectionId }).populate(
        "sectionId",
      ),
    );
    return;
  }
  res.json((await source.load(req.user._id)) || { days: [] });
});
router.get("/timetable", scheduling, async (req, res) =>
  res.json(
    await Timetable.find({
      sectionId: {
        $in: (await Section.find(sectionFilter(req)).select("_id")).map(
          (s) => s._id,
        ),
      },
    }).populate("sectionId"),
  ),
);
router.get("/timetable/teacher/:teacherId", scheduling, async (req, res) => {
  await teacherScope(req, await Teacher.findById(req.params.teacherId));
  return C.getByTeacher(req, res);
});
router.get("/timetable/:sectionId", scheduling, async (req, res) => {
  const section = await Section.findById(req.params.sectionId);
  if (!section) fail("Section not found.", 404);
  scope(req, section.departmentId);
  return C.getBySection(req, res);
});
for (const [path, fn] of [
  ["generate", "generatePreview"],
  ["save", "saveGenerated"],
  ["validate-edited", "validateEdited"],
  ["save-edited", "saveEdited"],
]) {
  router.post(
    "/timetable/" + path,
    scheduling,
    transactional(async (req, res) => {
      const section = await Section.findById(req.body.sectionId);
      if (!section) fail("Section not found.", 404);
      if (
        req.user.role === "hod" &&
        !same(req.user.departmentId, section.departmentId)
      )
        fail("You can manage timetables only in your department.", 403);
      const subjects = await Subject.find({ sectionId: section._id });
      const requiredTeacherIds = subjects.flatMap((s) => [
        ...s.allowedTeachers,
        ...s.batchAssignments.flatMap((b) => b.allowedTeachers),
      ]);
      const unlinked = await Teacher.exists({
        _id: { $in: requiredTeacherIds },
        $or: [{ userId: { $exists: false } }, { userId: null }],
      });
      if (unlinked)
        fail(
          "Link every scheduling teacher to a staff account in People before generating.",
        );
      if (
        ["save", "save-edited"].includes(path) &&
        (await Leave.exists({
          status: { $in: W.ACTIVE },
          endDate: { $gte: new Date(new Date().toISOString().slice(0, 10)) },
        }))
      )
        fail(
          "A current or future leave workflow exists. Timetable changes are locked to preserve substitute coverage.",
          409,
        );
      await C[fn](req, res);
    }),
  );
}
router.put(
  "/departments/:id",
  manage,
  transactional(async (req, res) => {
    if (typeof req.body.name !== "string" || !req.body.name.trim())
      fail("Department name is required.");
    const result = await Department.findByIdAndUpdate(
      req.params.id,
      { $set: { name: req.body.name.trim() } },
      { new: true, runValidators: true },
    );
    if (!result) fail("Department not found.", 404);
    res.json(result);
  }),
);
router.delete(
  "/departments/:id",
  manage,
  transactional(async (req, res) => {
    if (
      (await Section.exists({ departmentId: req.params.id })) ||
      (await User.exists({ departmentId: req.params.id })) ||
      (await require("../models/Notice").exists({
        departmentId: req.params.id,
      }))
    )
      fail(
        "Reassign linked sections, users and notices before deleting this department.",
        409,
      );
    const result = await Department.findByIdAndDelete(req.params.id);
    if (!result) fail("Department not found.", 404);
    res.json({ message: "Department deleted." });
  }),
);
router.delete(
  "/teachers/:id",
  scheduling,
  transactional(async (req, res) => {
    const teacher = await Teacher.findById(req.params.id);
    if (!teacher) fail("Teacher not found.", 404);
    await teacherScope(req, teacher);
    if (
      (await Subject.exists({
        $or: [
          { allowedTeachers: teacher._id },
          { "batchAssignments.allowedTeachers": teacher._id },
        ],
      })) ||
      (await Timetable.exists({})) ||
      (await Leave.exists({ status: { $in: W.ACTIVE } }))
    )
      fail(
        "Remove subject assignments, saved schedules and active leave dependencies before deleting a scheduling profile.",
        409,
      );
    await teacher.deleteOne();
    res.json({
      message: "Scheduling profile deleted. The user account is retained.",
    });
  }),
);
module.exports = router;
