const express = require("express");
const router = express.Router();

const { verifyOtpAndActivate } = require("../controllers/otpController");
const { otpLimiter } = require("../middlewares/rateLimiter");

router.post("/verify", otpLimiter, verifyOtpAndActivate);

module.exports = router;
