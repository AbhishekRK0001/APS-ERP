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
router.get("/departments", async (req, res) =>
  res.json(await Department.find().sort({ name: 1 })),
);
router.post("/departments", manage, async (req, res) => {
  if (typeof req.body.name !== "string" || !req.body.name.trim())
    fail("Department name is required.");
  res.status(201).json(await Department.create({ name: req.body.name.trim() }));
});
router.get("/sections", async (req, res) =>
  res.json(await Section.find().sort({ semester: 1, name: 1 })),
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
    manage,
    transactional(async (req, res) => {
      const record =
        method !== "post"
          ? await (type === "section" ? Section : Subject).findById(
              req.params.id,
            )
          : null;
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
router.get("/subjects", async (req, res) =>
  res.json(
    await Subject.find(
      req.query.sectionId ? { sectionId: req.query.sectionId } : {},
    )
      .populate("allowedTeachers")
      .populate("batchAssignments.allowedTeachers")
      .populate("sectionId"),
  ),
);
router.get("/teachers", async (req, res) =>
  res.json(await Teacher.find().populate("subjects")),
);
router.post(
  "/teachers",
  manage,
  transactional(async (req, res) => {
    const user = await User.findById(req.body.userId);
    if (!user || !staff.includes(user.role))
      fail("Select an existing staff account.");
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
  manage,
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
    if (req.body.userId) {
      const user = await User.findById(req.body.userId);
      if (!user || !staff.includes(user.role))
        fail("Select an existing staff account.");
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
  manage,
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
router.get("/timetable", scheduling, C.getAll);
router.get("/timetable/teacher/:teacherId", scheduling, C.getByTeacher);
router.get("/timetable/:sectionId", scheduling, C.getBySection);
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
      const unlinked = await Teacher.exists({
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
module.exports = router;
