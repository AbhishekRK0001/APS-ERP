const Staff = require("../models/Staff");

const classScopeCheck = async (req, res, next) => {
  try {
    if (req.user.role === "CLASS_TEACHER") {
      const { section } = req.body;

      // Get teacher record
      const teacher = await Staff.findOne({ userId: req.user._id });

      if (!teacher) {
        return res.status(403).json({
          message: "Teacher record not found"
        });
      }

      // ⚠️ You must later store assigned section in Staff model
      if (teacher.section && teacher.section !== section) {
        return res.status(403).json({
          message: "Cannot create student outside your class"
        });
      }
    }

    next();
  } catch (err) {
    return res.status(500).json({ message: "Scope check failed" });
  }
};

module.exports = classScopeCheck;