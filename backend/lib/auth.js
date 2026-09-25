const crypto = require("node:crypto");
const Session = require("../models/Session");
const User = require("../models/User");
const { fail } = require("./policy");
const hash = (value) => crypto.createHash("sha256").update(value).digest("hex");
function cookie(req) {
  const raw = req.headers.cookie
    ?.split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith("aps_session="));
  return raw?.slice(12);
}
async function protect(req, res, next) {
  const token = cookie(req);
  if (!token) return res.status(401).json({ message: "Please sign in." });
  const session = await Session.findOne({
    hash: hash(token),
    expiresAt: { $gt: new Date() },
  });
  const user = session && (await User.findById(session.userId));
  if (!user || !["ACTIVE", "ALUMNI"].includes(user.status))
    return res
      .status(401)
      .json({ message: "Session expired or account inactive." });
  req.user = user;
  req.session = session;
  next();
}
const authorize =
  (...roles) =>
  (req, res, next) => {
    if (!roles.includes(req.user.role))
      return res
        .status(403)
        .json({ message: "You do not have permission for this action." });
    next();
  };
const cookieOptions = () => ({
  httpOnly: true,
  sameSite: "strict",
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 7 * 86400000,
});
async function signIn(res, user) {
  const token = crypto.randomBytes(32).toString("hex");
  await Session.create({
    hash: hash(token),
    userId: user._id,
    expiresAt: new Date(Date.now() + 7 * 86400000),
  });
  res.cookie("aps_session", token, cookieOptions());
}
function publicUser(user) {
  const obj = user.toObject ? user.toObject() : { ...user };
  for (const key of [
    "password",
    "loginAttempts",
    "lockUntil",
    "workflowRevision",
    "__v",
  ])
    delete obj[key];
  return obj;
}
function writeGuard(req, res, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  if (req.headers.origin && req.headers.origin !== process.env.APP_ORIGIN)
    fail("Request origin is not allowed.", 403);
  if (!req.is("application/json") && !req.is("multipart/form-data"))
    fail("Send JSON or multipart form data.", 415);
  next();
}
module.exports = {
  protect,
  authorize,
  signIn,
  publicUser,
  hash,
  cookieOptions,
  writeGuard,
};
