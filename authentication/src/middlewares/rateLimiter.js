const rateLimit = require("express-rate-limit");

// 🔐 Login limiter
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 5,
  message: "Too many login attempts. Try again later."
});

// 🔐 OTP limiter
const otpLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 5,
  message: "Too many OTP requests. Try later."
});

module.exports = { loginLimiter, otpLimiter };
