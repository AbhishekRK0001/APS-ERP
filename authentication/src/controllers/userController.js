const User = require("../models/User");
const Student = require("../models/Student");
const Staff = require("../models/Staff");
const AuditLog = require("../models/AuditLog");
const bcrypt = require("bcrypt");
const canCreateRole = require("../utils/roleCheck");

const createUser = async (req, res) => {
  try {
    const { usn, email, role, name, department, section } = req.body;

    // Role hierarchy check
    if (!canCreateRole(req.user.role, role)) {
      return res.status(403).json({
        message: "Cannot create this role"
      });
    }

    // Duplicate check
    const existing = await User.findOne({ usn });
    if (existing) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash("Temp@123", 10);

    const newUser = await User.create({
      usn,
      email,
      password: hashedPassword,
      role,
      createdBy: req.user._id
    });

    // Role-specific creation
    if (role === "STUDENT") {
      await Student.create({
        userId: newUser._id,
        name,
        department,
        section
      });
    } else {
      await Staff.create({
        userId: newUser._id,
        name,
        department,
        designation: role
      });
    }

    // ✅ AUDIT LOG (NEW)
    await AuditLog.create({
      actorId: req.user._id,
      targetId: newUser._id,
      action: "USER_CREATED",
      metadata: { role }
    });


    const { createOtpForUser } = require("../utils/otpService");
    // Generate OTP
    await createOtpForUser(newUser._id);

    res.status(201).json({
      message: "User created successfully. OTP sent.",
      userId: newUser._id
    });

    
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { createUser };