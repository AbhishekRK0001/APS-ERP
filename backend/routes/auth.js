const router = require("express").Router();
const bcrypt = require("bcryptjs");
const crypto = require("node:crypto");
const nodemailer = require("nodemailer");
const { rateLimit } = require("express-rate-limit");
const User = require("../models/User");
const Activation = require("../models/Activation");
const Session = require("../models/Session");
const { protect, signIn, publicUser, cookieOptions } = require("../lib/auth");
const { fail } = require("../lib/policy");
const limit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});
const otpHash = (userId, otp) =>
  crypto
    .createHmac("sha256", process.env.OTP_SECRET)
    .update(`${userId}:${otp}`)
    .digest("hex");
async function sendOtp(user) {
  const otp = String(crypto.randomInt(100000, 1000000));
  await Activation.findOneAndUpdate(
    { userId: user._id },
    {
      hash: otpHash(user._id, otp),
      attempts: 0,
      expiresAt: new Date(Date.now() + 5 * 60000),
    },
    { upsert: true },
  );
  try {
    if (
      process.env.NODE_ENV !== "production" &&
      process.env.DEV_OTP_CONSOLE === "true"
    )
      console.log(`Activation code for ${user.email}: ${otp}`);
    else {
      if (!process.env.SMTP_HOST)
        fail("Email delivery is not configured. Ask your administrator.", 503);
      const smtp = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: Number(process.env.SMTP_PORT) === 465,
        auth: process.env.SMTP_USER
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
          : undefined,
      });
      await smtp.sendMail({
        from: process.env.MAIL_FROM,
        to: user.email,
        subject: "Activate your APS ERP account",
        text: `Your activation code is ${otp}. It expires in five minutes.`,
      });
    }
  } catch (e) {
    await Activation.deleteOne({ userId: user._id });
    throw e;
  }
}
router.post("/login", limit, async (req, res) => {
  const { identifier, password } = req.body;
  if (typeof identifier !== "string" || typeof password !== "string")
    fail("Email / college ID and password are required.");
  const value = identifier.trim();
  const user = await User.findOne({
    $or: [{ email: value.toLowerCase() }, { usn: value }],
  }).select("+password");
  if (!user) fail("Invalid credentials.", 401);
  if (user.lockUntil > Date.now())
    fail("Account temporarily locked. Try again in 15 minutes.", 429);
  if (!(await bcrypt.compare(password, user.password))) {
    const attempts =
      (user.lockUntil && user.lockUntil <= Date.now()
        ? 0
        : user.loginAttempts) + 1;
    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          loginAttempts: attempts,
          lockUntil: attempts >= 5 ? new Date(Date.now() + 15 * 60000) : null,
        },
      },
    );
    fail("Invalid credentials.", 401);
  }
  if (!["ACTIVE", "ALUMNI"].includes(user.status))
    fail("Activate your account first, or contact your administrator.", 403);
  await User.updateOne(
    { _id: user._id },
    { $set: { loginAttempts: 0, lockUntil: null } },
  );
  await signIn(res, user);
  res.json({ user: publicUser(user) });
});
router.get("/me", protect, (req, res) =>
  res.json({ user: publicUser(req.user) }),
);
router.post("/logout", protect, async (req, res) => {
  await Session.deleteOne({ _id: req.session._id });
  res.clearCookie("aps_session", { ...cookieOptions(), maxAge: undefined });
  res.json({ message: "Signed out." });
});
router.post("/activation/request", limit, async (req, res) => {
  if (typeof req.body.identifier !== "string")
    fail("Email / college ID is required.");
  const value = req.body.identifier.trim();
  const user = await User.findOne({
    status: "PENDING",
    $or: [{ email: value.toLowerCase() }, { usn: value }],
  });
  if (user) await sendOtp(user);
  res.json({
    message: "If a pending account matches, an activation code has been sent.",
  });
});
router.post("/activation/verify", limit, async (req, res) => {
  const { identifier, otp, newPassword } = req.body;
  if (
    typeof identifier !== "string" ||
    typeof otp !== "string" ||
    !/^\d{6}$/.test(otp) ||
    typeof newPassword !== "string" ||
    newPassword.length < 12 ||
    newPassword.length > 128
  )
    fail("Enter a six-digit code and a password of 12–128 characters.");
  const value = identifier.trim();
  const user = await User.findOne({
    status: "PENDING",
    $or: [{ email: value.toLowerCase() }, { usn: value }],
  });
  if (!user) fail("Invalid or expired activation code.");
  const record = await Activation.findOneAndUpdate(
    { userId: user._id, expiresAt: { $gt: new Date() }, attempts: { $lt: 5 } },
    { $inc: { attempts: 1 } },
    { new: true },
  );
  if (!record || record.hash !== otpHash(user._id, otp))
    fail("Invalid or expired activation code.");
  const consumed = await Activation.findOneAndDelete({
    _id: record._id,
    hash: record.hash,
  });
  if (!consumed) fail("Code already used.");
  await User.updateOne(
    { _id: user._id, status: "PENDING" },
    {
      $set: { password: await bcrypt.hash(newPassword, 12), status: "ACTIVE" },
    },
  );
  res.json({ message: "Account activated. You can now sign in." });
});
module.exports = router;
