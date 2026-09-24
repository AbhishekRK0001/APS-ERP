const router = require("express").Router();
const Leave = require("../../leave-management/backend/models/Leave");
const Request = require("../../leave-management/backend/models/SubstituteRequest");
const Balance = require("../../leave-management/backend/models/LeaveBalance");
const User = require("../models/User");
const W = require("../../leave-management/backend/services/leaveWorkflow");
const { authorize } = require("../lib/auth");
const { same, fail } = require("../lib/policy");
const teachers = authorize("teacher", "class_teacher", "hod", "principal");
const reviewers = authorize("hod", "principal");
const populated = (q) =>
  q
    .populate("teacher", "name email departmentId")
    .populate({
      path: "substituteRequests",
      populate: { path: "substituteTeacher", select: "name email" },
    })
    .sort({ createdAt: -1 });
router.get("/leaves/my", teachers, async (req, res) =>
  res.json(await populated(Leave.find({ teacher: req.user._id }))),
);
router.get("/leaves/balance", teachers, async (req, res) => {
  const year = new Date().getUTCFullYear();
  res.json(
    await Balance.findOneAndUpdate(
      { teacher: req.user._id, year },
      { $setOnInsert: { teacher: req.user._id, year } },
      { upsert: true, new: true },
    ),
  );
});
router.post("/substitutes/request", teachers, async (req, res) => {
  if (
    W.date(req.body.startDate) < W.date(new Date().toISOString().slice(0, 10))
  )
    fail("Leave cannot start in the past.");
  if (!W.TYPES.includes(req.body.leaveType)) fail("Select a valid leave type.");
  res.status(201).json(await W.createCoverage(req.user._id, req.body));
});
router.get("/substitutes/my", teachers, async (req, res) => {
  const requests = await Request.find({
    status: "open",
    absentTeacher: { $ne: req.user._id },
    declinedBy: { $ne: req.user._id },
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
      (await W.eligible(req.user._id, request, null))
    )
      relevant.push(request);
  res.json(relevant);
});
router.get("/substitutes/accepted", teachers, async (req, res) =>
  res.json(
    await Request.find({
      substituteTeacher: req.user._id,
      status: { $in: W.CONFIRMED },
    })
      .populate("absentTeacher", "name")
      .sort({ date: 1, periodNumber: 1 }),
  ),
);
router.patch("/substitutes/:id/accept", teachers, async (req, res) =>
  res.json(await W.accept(req.params.id, req.user._id)),
);
router.patch("/substitutes/:id/decline", teachers, async (req, res) => {
  const request = await Request.findOneAndUpdate(
    {
      _id: req.params.id,
      status: "open",
      absentTeacher: { $ne: req.user._id },
    },
    { $addToSet: { declinedBy: req.user._id } },
    { new: true },
  );
  if (!request) fail("Request no longer open.", 409);
  res.json({ message: "Declined." });
});
router.patch("/leaves/:id/details", teachers, async (req, res) =>
  res.json(await W.submit(req.params.id, req.user._id, req.body)),
);
router.get("/leaves/review", reviewers, async (req, res) => {
  const filter = {
    status: req.user.role === "hod" ? "submitted" : "hod_approved",
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
  res.json(await W.approve(req.params.id, req.user.role));
});
router.patch("/leaves/:id/reject", reviewers, async (req, res) => {
  await checkScope(req);
  res.json(await W.reject(req.params.id, req.user, req.body.reason));
});
module.exports = router;
