const Otp = require("../models/Otp");
const User = require("../models/User");
const bcrypt = require("bcrypt");

const verifyOtpAndActivate = async (req, res) => {
  try {
    const { usn, otp, newPassword } = req.body;

    if (!usn || !otp || !newPassword) {
      return res.status(400).json({ message: "All fields required" });
    }

    const user = await User.findOne({ usn });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const otpRecord = await Otp.findOne({ userId: user._id });

    if (!otpRecord) {
      return res.status(400).json({ message: "OTP not found" });
    }

    // Expiry check
    if (otpRecord.expiresAt < new Date()) {
      return res.status(400).json({ message: "OTP expired" });
    }

    // Attempt limit
    if (otpRecord.attempts >= 5) {
      return res.status(403).json({ message: "Too many attempts" });
    }

    // Verify OTP
    if (otpRecord.otp !== otp) {
      otpRecord.attempts += 1;
      await otpRecord.save();
      return res.status(400).json({ message: "Invalid OTP" });
    }

    // ✅ OTP correct → activate user
    user.password = await bcrypt.hash(newPassword, 10);
    user.status = "ACTIVE";
    await user.save();

    // Delete OTP
    await Otp.deleteMany({ userId: user._id });

    res.json({ message: "Account activated successfully" });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { verifyOtpAndActivate };