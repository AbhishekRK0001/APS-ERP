const bcrypt = require("bcrypt");
const User = require("../models/User");
const AuditLog = require("../models/AuditLog");
const {
  generateAccessToken,
  generateRefreshToken
} = require("../utils/tokenService");

const MAX_ATTEMPTS = 5;
const LOCK_TIME = 15 * 60 * 1000;

const login = async (req, res) => {
  try {
    const { identifier, password } = req.body;

    const user = await User.findOne({
      $or: [{ email: identifier }, { usn: identifier }]
    });

    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    if (user.lockUntil && user.lockUntil > Date.now()) {
      return res.status(403).json({ message: "Account locked" });
    }

    if (user.status !== "ACTIVE" && user.status !== "ALUMNI") {
      return res.status(403).json({ message: "Account not active" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      user.loginAttempts += 1;

      if (user.loginAttempts >= MAX_ATTEMPTS) {
        user.lockUntil = Date.now() + LOCK_TIME;
      }

      await user.save();
      return res.status(401).json({ message: "Invalid credentials" });
    }

    user.loginAttempts = 0;
    user.lockUntil = null;

    // 🔐 Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Store refresh token
    user.refreshTokens.push(refreshToken);
    await user.save();

    // Audit log
    await AuditLog.create({
      actorId: user._id,
      targetId: user._id,
      action: "LOGIN_SUCCESS"
    });

    res.json({
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        role: user.role,
        usn: user.usn
      }
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { login };