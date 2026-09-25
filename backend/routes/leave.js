const router = require("express").Router();
const Leave = require("../../leave-management/backend/models/Leave");
const Request = require("../../leave-management/backend/models/SubstituteRequest");
const Balance = require("../../leave-management/backend/models/LeaveBalance");
const User = require("../models/User");
const W = require("../../leave-management/backend/services/leaveWorkflow");
const { authorize } = require("../lib/auth");
const { same, fail, editors, staff } = require("../lib/policy");
const teachers = authorize(...staff, "admin", "super_admin");
router.use(async (req, res, next) => {
  const writing = !["GET", "HEAD", "OPTIONS"].includes(req.method);
  // This router is mounted at /api, so do not intercept other modules.
  if (!/^\/(leaves|substitutes)(\/|$)/.test(req.path)) return next();
  const ownAppeal =
    ["teacher", "class_teacher"].includes(req.user.role) &&
    ((req.method === "POST" && req.path === "/substitutes/request") ||
      (req.method === "PATCH" && /^\/leaves\/[^/]+\/details$/.test(req.path)));
  if (writing && !editors.includes(req.user.role) && !ownAppeal)
    fail(
      "You may submit your own leave appeal only. Coverage and reviews are managed by campus management.",
      403,
    );
  req.leaveUser = req.user;
  const targetId = req.query.teacherId || req.body?.teacherId;
  if (targetId && !same(targetId, req.leaveUser._id)) {
    if (!editors.includes(req.user.role))
      fail("You can view only your own leave records.", 403);
    const target = await User.findById(targetId);
    if (!target || !staff.includes(target.role))
      fail("Teaching account not found.", 404);
    if (
      req.user.role === "hod" &&
      !same(target.departmentId, req.user.departmentId)
    )
      fail("Staff member is outside your department.", 403);
    req.leaveUser = target;
  }
  next();
});
const reviewers = authorize(...editors);
const populated = (q) =>
  q
    .populate("teacher", "name email departmentId")
    .populate({
      path: "substituteRequests",
      populate: { path: "substituteTeacher", select: "name email" },
    })
    .sort({ createdAt: -1 });
router.get("/leaves/my", teachers, async (req, res) =>
  res.json(await populated(Leave.find({ teacher: req.leaveUser._id }))),
);
router.get("/leaves/balance", teachers, async (req, res) => {
  const year = new Date().getUTCFullYear();
  res.json(
    (await Balance.findOne({ teacher: req.leaveUser._id, year })) ||
      new Balance({ teacher: req.leaveUser._id, year }),
  );
});
router.post("/substitutes/request", teachers, async (req, res) => {
  if (
    W.date(req.body.startDate) < W.date(new Date().toISOString().slice(0, 10))
  )
    fail("Leave cannot start in the past.");
  if (!W.TYPES.includes(req.body.leaveType)) fail("Select a valid leave type.");
  if (!staff.includes(req.leaveUser.role) || req.leaveUser.status !== "ACTIVE")
    fail("Choose an active teaching account first.");
  res.status(201).json(await W.createCoverage(req.leaveUser._id, req.body));
});
router.get("/substitutes/my", reviewers, async (req, res) => {
  const requests = await Request.find({
    status: "open",
    absentTeacher: { $ne: req.leaveUser._id },
    declinedBy: { $ne: req.leaveUser._id },
  })
    .populate("absentTeacher", "name")
    .populate("leave");
  const relevant = [];
  for (const request of requests)
    if (
      request.leave &&
      ["coverage_pending", "substitute_confirmed"].includes(
        request.leave.status,
      ) &&
      (await W.eligible(req.leaveUser._id, request, null))
    )
      relevant.push(request);
  res.json(relevant);
});
router.get("/substitutes/accepted", reviewers, async (req, res) =>
  res.json(
    await Request.find({
      substituteTeacher: req.leaveUser._id,
      status: { $in: W.CONFIRMED },
    })
      .populate("absentTeacher", "name")
      .sort({ date: 1, periodNumber: 1 }),
  ),
);
router.patch("/substitutes/:id/accept", teachers, async (req, res) =>
  res.json(await W.accept(req.params.id, req.leaveUser._id)),
);
router.patch("/substitutes/:id/decline", teachers, async (req, res) => {
  const request = await Request.findOneAndUpdate(
    {
      _id: req.params.id,
      status: "open",
      absentTeacher: { $ne: req.leaveUser._id },
    },
    { $addToSet: { declinedBy: req.leaveUser._id } },
    { new: true },
  );
  if (!request) fail("Request no longer open.", 409);
  res.json({ message: "Declined." });
});
router.patch("/leaves/:id/details", teachers, async (req, res) =>
  res.json(await W.submit(req.params.id, req.leaveUser._id, req.body)),
);
router.get("/leaves/review", reviewers, async (req, res) => {
  const filter = {
    status:
      req.user.role === "hod"
        ? "submitted"
        : req.user.role === "principal"
          ? "hod_approved"
          : { $in: ["submitted", "hod_approved"] },
    teacher: { $ne: req.user._id },
  };
  if (req.user.role === "hod") {
    if (!req.user.departmentId) return res.json([]);
    filter.teacher = {
      $in: (
        await User.find({
          departmentId: req.user.departmentId,
          _id: { $ne: req.user._id },
        }).select("_id")
      ).map((x) => x._id),
    };
  }
  res.json(await populated(Leave.find(filter)));
});
async function checkScope(req) {
  const leave = await Leave.findById(req.params.id).populate("teacher");
  if (!leave) fail("Leave not found.", 404);
  if (same(leave.teacher, req.user))
    fail("You cannot review your own leave.", 403);
  if (
    req.user.role === "hod" &&
    !same(leave.teacher.departmentId, req.user.departmentId)
  )
    fail("Leave belongs to another department.", 403);
}
router.patch("/leaves/:id/approve", reviewers, async (req, res) => {
  await checkScope(req);
  const leave = await Leave.findById(req.params.id);
  const stage = ["admin", "super_admin"].includes(req.user.role)
    ? leave.status === "submitted"
      ? "hod"
      : "principal"
    : req.user.role;
  res.json(await W.approve(req.params.id, stage));
});
router.patch("/leaves/:id/reject", reviewers, async (req, res) => {
  await checkScope(req);
  const leave = await Leave.findById(req.params.id);
  const role = ["admin", "super_admin"].includes(req.user.role)
    ? leave.status === "submitted"
      ? "hod"
      : "principal"
    : req.user.role;
  res.json(
    await W.reject(
      req.params.id,
      { ...req.user.toObject(), role },
      req.body.reason,
    ),
  );
});
router.get("/leaves/all", reviewers, async (req, res) => {
  const filter =
    req.user.role === "hod"
      ? {
          teacher: {
            $in: (
              await User.find({ departmentId: req.user.departmentId }).select(
                "_id",
              )
            ).map((u) => u._id),
          },
        }
      : {};
  res.json(await populated(Leave.find(filter)));
});
module.exports = router;
