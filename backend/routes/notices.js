const router = require("express").Router();
const Notice = require("../models/Notice");
const Read = require("../models/NotificationRead");
const Section = require("../../timetable/server/models/Section");
const Department = require("../../timetable/server/models/Department");
const { authorize } = require("../lib/auth");
const { managers, same, fail, noticeQuery } = require("../lib/policy");
const writers = authorize(...managers, "hod");
const reviewers = authorize(...managers, "hod");
const details = (q) =>
  q
    .populate("postedBy", "name role")
    .populate("sectionId", "name")
    .populate("departmentId", "name")
    .sort({ isPinned: -1, publishAt: -1 });
router.get("/notices", async (req, res) => {
  const query = noticeQuery(req.user);
  if (req.query.category) query.category = req.query.category;
  res.json(await details(Notice.find(query)));
});
router.get("/notices/mine", writers, async (req, res) =>
  res.json(await details(Notice.find({ postedBy: req.user._id }))),
);
router.get("/notices/pending", reviewers, async (req, res) => {
  if (req.user.role === "hod" && !req.user.departmentId) return res.json([]);
  res.json(
    await details(
      Notice.find({
        approvalStatus: "PENDING",
        ...(req.user.role === "hod"
          ? { departmentId: req.user.departmentId }
          : {}),
      }),
    ),
  );
});
router.get("/feed", async (req, res) =>
  res.json(
    await details(Notice.find({ ...noticeQuery(req.user), showInFeed: true })),
  ),
);
router.get("/ticker", async (req, res) =>
  res.json(
    await details(
      Notice.find({ ...noticeQuery(req.user), showInTicker: true }),
    ),
  ),
);
router.post("/notices", writers, async (req, res) => {
  const b = req.body;
  const teacher = ["teacher", "class_teacher"].includes(req.user.role);
  if (
    typeof b.title !== "string" ||
    !b.title.trim() ||
    typeof b.description !== "string" ||
    !b.description.trim()
  )
    fail("Title and description are required.");
  if (b.title.length > 200 || b.description.length > 10000)
    fail("Notice is too long.");
  if (!["COLLEGE", "DEPARTMENT", "SECTION"].includes(b.scope))
    fail("Select a valid audience.");
  let departmentId = b.departmentId || null,
    sectionId = b.sectionId || null;
  if (
    teacher &&
    (b.scope !== "SECTION" ||
      !req.user.assignedSectionIds.some((id) => same(id, sectionId)))
  )
    fail("Teachers can post only to their assigned sections.", 403);
  if (b.scope === "COLLEGE") {
    if (!managers.includes(req.user.role))
      fail("College notices require Principal or Admin permission.", 403);
    departmentId = null;
    sectionId = null;
  }
  if (b.scope === "SECTION") {
    const section = await Section.findById(sectionId);
    if (!section) fail("Section not found.");
    departmentId = section.departmentId;
  }
  if (b.scope === "DEPARTMENT") {
    sectionId = null;
    if (req.user.role === "hod") departmentId = req.user.departmentId;
  }
  if (
    b.scope !== "COLLEGE" &&
    (!departmentId || !(await Department.exists({ _id: departmentId })))
  )
    fail("Select a valid department.");
  if (req.user.role === "hod" && !same(departmentId, req.user.departmentId))
    fail("Audience is outside your department.", 403);
  const payload = {};
  for (const key of [
    "title",
    "description",
    "type",
    "category",
    "postStyle",
    "priority",
    "targetYear",
    "targetSemester",
    "dueDate",
    "eventDate",
    "registrationDeadline",
    "actionLabel",
    "actionUrl",
    "showInFeed",
    "showInTicker",
    "isPinned",
    "expiresAt",
    "publishAt",
  ])
    if (b[key] !== undefined && b[key] !== "") payload[key] = b[key];
  if (payload.actionUrl && !/^https?:\/\//i.test(payload.actionUrl))
    fail("Action links must use http or https.");
  if (
    payload.expiresAt &&
    new Date(payload.expiresAt) <= new Date(payload.publishAt || Date.now())
  )
    fail("Expiry must follow publication.");
  const attachments = Array.isArray(b.attachments) ? b.attachments : [];
  for (const a of attachments) {
    if (typeof a.url !== "string") fail("Invalid attachment.");
    if (a.url.startsWith("/api/attachments/")) {
      const file = await require("../models/Attachment").findOne({
        _id: a.url.slice(17),
        owner: req.user._id,
      });
      if (!file) fail("Attachment does not belong to you.", 403);
    } else if (!/^https:\/\//i.test(a.url))
      fail("Attachment links must use HTTPS.");
  }
  const requiresApproval = b.requestApproval === true;
  const notice = await Notice.create({
    ...payload,
    attachments,
    scope: b.scope,
    departmentId,
    sectionId,
    postedBy: req.user._id,
    requiresApproval,
    approvalStatus: requiresApproval ? "PENDING" : "NOT_REQUIRED",
    isPublished: !requiresApproval,
  });
  res.status(201).json({
    notice,
    message: requiresApproval ? "Sent for approval." : "Notice published.",
  });
});
router.post("/notices/:id/approval", reviewers, async (req, res) => {
  const notice = await Notice.findById(req.params.id);
  if (!notice) fail("Notice not found.", 404);
  if (same(notice.postedBy, req.user._id))
    fail("You cannot approve your own notice.", 403);
  if (
    req.user.role === "hod" &&
    !same(notice.departmentId, req.user.departmentId)
  )
    fail("Notice belongs to another department.", 403);
  if (!["APPROVE", "REJECT"].includes(req.body.action))
    fail("Choose approve or reject.");
  if (req.body.action === "REJECT" && !req.body.reason?.trim())
    fail("Rejection reason is required.");
  const approve = req.body.action === "APPROVE";
  const result = await Notice.findOneAndUpdate(
    { _id: notice._id, approvalStatus: "PENDING" },
    {
      $set: {
        approvalStatus: approve ? "APPROVED" : "REJECTED",
        isPublished: approve,
        ...(approve
          ? { approvedBy: req.user._id, approvedAt: new Date() }
          : {
              rejectedBy: req.user._id,
              rejectedAt: new Date(),
              rejectionReason: req.body.reason,
            }),
      },
    },
    { new: true },
  );
  if (!result) fail("Notice is no longer pending.", 409);
  res.json(result);
});
router.get("/notifications", async (req, res) => {
  const notices = await details(Notice.find(noticeQuery(req.user))).limit(50);
  const reads = await Read.find({
    userId: req.user._id,
    noticeId: { $in: notices.map((n) => n._id) },
  });
  const ids = new Set(reads.map((x) => String(x.noticeId)));
  res.json(
    notices.map((n) => ({ ...n.toObject(), isRead: ids.has(String(n._id)) })),
  );
});
router.post("/notifications/read", async (req, res) => {
  const notice = await Notice.findOne({
    ...noticeQuery(req.user),
    _id: req.body.noticeId,
  });
  if (!notice) fail("Notice not found.", 404);
  await Read.updateOne(
    { userId: req.user._id, noticeId: notice._id },
    { $set: { readAt: new Date() } },
    { upsert: true },
  );
  res.json({ message: "Marked read." });
});
router.patch("/notices/:id", writers, async (req, res) => {
  const notice = await Notice.findById(req.params.id);
  if (!notice) fail("Notice not found.", 404);
  if (
    req.user.role === "hod" &&
    !same(notice.departmentId, req.user.departmentId)
  )
    fail("Notice is outside your department.", 403);
  const b = req.body;
  for (const [field, max] of [
    ["title", 200],
    ["description", 10000],
  ]) {
    if (b[field] !== undefined) {
      if (
        typeof b[field] !== "string" ||
        !b[field].trim() ||
        b[field].length > max
      )
        fail(`Enter a valid ${field}.`);
      notice[field] = b[field].trim();
    }
  }
  if (b.isPinned !== undefined) {
    if (typeof b.isPinned !== "boolean") fail("Pin must be true or false.");
    notice.isPinned = b.isPinned;
  }
  await notice.save();
  res.json(notice);
});
router.delete("/notices/:id", writers, async (req, res) => {
  const notice = await Notice.findById(req.params.id);
  if (!notice) fail("Notice not found.", 404);
  if (
    req.user.role === "hod" &&
    !same(notice.departmentId, req.user.departmentId)
  )
    fail("Notice is outside your department.", 403);
  await notice.deleteOne();
  await Read.deleteMany({ noticeId: notice._id });
  res.json({ message: "Notice deleted." });
});
module.exports = router;
