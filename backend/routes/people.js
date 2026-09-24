const router = require("express").Router();
const bcrypt = require("bcryptjs");
const crypto = require("node:crypto");
const User = require("../models/User");
const Session = require("../models/Session");
const Department = require("../../timetable/server/models/Department");
const Section = require("../../timetable/server/models/Section");
const { authorize, publicUser } = require("../lib/auth");
const { ranks, managers, fail, same, canCreate } = require("../lib/policy");
router.use(authorize("super_admin", "admin", "principal", "hod"));
router.get("/", async (req, res) => {
  const filter = managers.includes(req.user.role)
    ? {}
    : { departmentId: req.user.departmentId || null };
  if (!managers.includes(req.user.role) && !req.user.departmentId)
    return res.json([]);
  if (req.user.role === "class_teacher") {
    filter.role = "student";
    filter.sectionId = { $in: req.user.assignedSectionIds };
  }
  res.json((await User.find(filter).sort({ name: 1 })).map(publicUser));
});
router.post("/", async (req, res) => {
  const b = req.body;
  if (!canCreate(req.user, b.role, b.departmentId, b.sectionId))
    fail("Role or department is outside your authority.", 403);
  if (
    typeof b.name !== "string" ||
    !b.name.trim() ||
    typeof b.email !== "string" ||
    !/^\S+@\S+\.\S+$/.test(b.email)
  )
    fail("Name and valid email are required.");
  if (
    ["student", "teacher", "class_teacher", "hod"].includes(b.role) &&
    (!b.departmentId || !(await Department.exists({ _id: b.departmentId })))
  )
    fail("Select a department.");
  if (
    b.role === "student" &&
    (!Number.isInteger(Number(b.currentSemester)) ||
      Number(b.currentSemester) < 1 ||
      Number(b.currentSemester) > 8)
  )
    fail("Select a semester from 1 to 8.");
  if (b.sectionId) {
    const section = await Section.findById(b.sectionId);
    if (
      !section ||
      !same(section.departmentId, b.departmentId) ||
      (b.role === "student" && section.semester !== Number(b.currentSemester))
    )
      fail("Section must match the selected department and semester.");
  }
  const assigned = Array.isArray(b.assignedSectionIds)
    ? b.assignedSectionIds
    : [];
  if (assigned.length) {
    const count = await Section.countDocuments({
      _id: { $in: assigned },
      departmentId: b.departmentId,
    });
    if (count !== new Set(assigned).size)
      fail("Assigned sections must belong to the selected department.");
  }
  const user = await User.create({
    name: b.name,
    email: b.email,
    usn: b.usn || undefined,
    role: b.role,
    departmentId: b.departmentId || null,
    sectionId: b.sectionId || null,
    assignedSectionIds: assigned,
    currentSemester: b.currentSemester || undefined,
    currentYear: b.currentSemester
      ? Math.ceil(Number(b.currentSemester) / 2)
      : undefined,
    password: await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 12),
    status: "PENDING",
    createdBy: req.user._id,
  });
  res.status(201).json({
    user: publicUser(user),
    message:
      "Account created. The user can request an activation code from the sign-in page.",
  });
});
router.patch("/:id/status", async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) fail("Account not found.", 404);
  if (!canCreate(req.user, user.role, user.departmentId, user.sectionId))
    fail("Account is outside your authority.", 403);
  if (
    !["ACTIVE", "FROZEN", "TERMINATED"].includes(req.body.status) ||
    ["REQUESTED", "REJECTED", "PENDING"].includes(user.status)
  )
    fail(
      "Pending accounts must complete activation; otherwise choose active, frozen or terminated.",
    );
  user.status = req.body.status;
  await user.save();
  await Session.deleteMany({ userId: user._id });
  res.json({ user: publicUser(user) });
});
router.patch("/:id/sections", async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user || !["teacher", "class_teacher", "hod"].includes(user.role))
    fail("Teaching account not found.", 404);
  if (!canCreate(req.user, user.role, user.departmentId, user.sectionId))
    fail("Account is outside your authority.", 403);
  const ids = req.body.assignedSectionIds;
  if (!Array.isArray(ids)) fail("Assigned sections are required.");
  if (
    (await Section.countDocuments({
      _id: { $in: ids },
      departmentId: user.departmentId,
    })) !== new Set(ids).size
  )
    fail("Sections must belong to the staff department.");
  user.assignedSectionIds = ids;
  await user.save();
  res.json({ user: publicUser(user) });
});
router.patch("/:id/section", async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user || user.role !== "student") fail("Student not found.", 404);
  const section = await Section.findById(req.body.sectionId);
  if (
    !section ||
    !same(section.departmentId, user.departmentId) ||
    section.semester !== user.currentSemester
  )
    fail("Choose a section in the student’s department and current semester.");
  if (!canCreate(req.user, user.role, user.departmentId, section._id))
    fail("Student is outside your authority.", 403);
  user.sectionId = section._id;
  await user.save();
  res.json({ user: publicUser(user) });
});
router.get("/requests", authorize("admin", "super_admin"), async (req, res) => {
  res.json(
    (await User.find({ status: "REQUESTED" }).sort({ createdAt: 1 })).map(
      publicUser,
    ),
  );
});
router.post(
  "/:id/review",
  authorize("admin", "super_admin"),
  async (req, res) => {
    const { action, reason } = req.body;
    if (!["APPROVE", "REJECT"].includes(action))
      fail("Choose approve or reject.");
    if (
      action === "REJECT" &&
      (typeof reason !== "string" || !reason.trim() || reason.length > 1000)
    )
      fail("Provide a rejection reason (up to 1000 characters).");
    const user = await User.findOneAndUpdate(
      {
        _id: req.params.id,
        status: "REQUESTED",
        role: { $in: ["student", "teacher", "class_teacher"] },
      },
      {
        $set: {
          status: action === "APPROVE" ? "PENDING" : "REJECTED",
          reviewedBy: req.user._id,
          reviewedAt: new Date(),
          rejectionReason: action === "REJECT" ? reason.trim() : "",
        },
      },
      { new: true, runValidators: true },
    );
    if (!user)
      fail("Request already reviewed or not found. Refresh the list.", 409);
    res.json({
      user: publicUser(user),
      message:
        action === "APPROVE"
          ? "Approved. The user can now request an activation code and set a password."
          : "Request rejected.",
    });
  },
);
module.exports = router;
