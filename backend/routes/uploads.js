const router = require("express").Router();
const multer = require("multer");
const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const Attachment = require("../models/Attachment");
const Notice = require("../models/Notice");
const { authorize } = require("../lib/auth");
const { managers, noticeQuery, same, fail } = require("../lib/policy");
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
});
const directory = path.resolve(__dirname, "../../uploads");
router.post(
  "/uploads/notices",
  authorize(...managers, "hod"),
  upload.single("file"),
  async (req, res) => {
    const f = req.file;
    if (!f) fail("Choose a file.");
    const b = f.buffer;
    const signatures = {
      "application/pdf": b.subarray(0, 5).toString() === "%PDF-",
      "image/png": b
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
      "image/jpeg": b[0] === 255 && b[1] === 216 && b[2] === 255,
      "image/webp":
        b.subarray(0, 4).toString() === "RIFF" &&
        b.subarray(8, 12).toString() === "WEBP",
    };
    if (!signatures[f.mimetype])
      fail("Upload a valid PDF, PNG, JPG or WEBP file.");
    const storedName = crypto.randomUUID();
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(path.join(directory, storedName), b);
    const a = await Attachment.create({
      name: path.basename(f.originalname).slice(0, 200),
      storedName,
      mimeType: f.mimetype,
      size: f.size,
      owner: req.user._id,
    });
    res.status(201).json({
      name: a.name,
      url: "/api/attachments/" + a._id,
      mimeType: a.mimeType,
      size: a.size,
    });
  },
);
router.get("/attachments/:id", async (req, res) => {
  const a = await Attachment.findById(req.params.id);
  if (!a) fail("File not found.", 404);
  const url = "/api/attachments/" + a._id;
  const pendingScope = managers.includes(req.user.role)
    ? {}
    : req.user.role === "hod" && req.user.departmentId
      ? { departmentId: req.user.departmentId }
      : null;
  const canReview =
    pendingScope &&
    (await Notice.exists({
      ...pendingScope,
      approvalStatus: "PENDING",
      "attachments.url": url,
    }));
  if (
    !canReview &&
    !same(a.owner, req.user._id) &&
    !(await Notice.exists({ ...noticeQuery(req.user), "attachments.url": url }))
  )
    fail("You do not have access to this file.", 403);
  res.setHeader("Content-Type", a.mimeType);
  res.setHeader(
    "Content-Disposition",
    `attachment; filename*=UTF-8''${encodeURIComponent(a.name)}`,
  );
  res.sendFile(path.join(directory, a.storedName));
});
module.exports = router;
