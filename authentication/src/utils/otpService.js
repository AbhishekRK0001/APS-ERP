const Otp = require("../models/Otp");

const generateOtp = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const createOtpForUser = async (userId) => {
  const otp = generateOtp();

  await Otp.deleteMany({ userId }); // remove old OTPs

  await Otp.create({
    userId,
    otp,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000) // 5 mins
  });

  console.log("OTP (dev only):", otp); // 🔴 later replace with email/SMS

  return otp;
};

module.exports = { createOtpForUser };