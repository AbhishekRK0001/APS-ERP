const router = require("express").Router();
const Cycle = require("../models/AcademicCycle");
const User = require("../models/User");
const Session = require("../models/Session");
const { authorize } = require("../lib/auth");
const { managers, fail } = require("../lib/policy");
const { transaction } = require("../lib/transaction");
router.use(authorize(...managers));
router.get("/preview", async (req, res) =>
  res.json({
    currentCycle: await Cycle.findOne({ isActive: true }),
    students: await User.find({
      role: "student",
      status: "ACTIVE",
      academicStatus: "ACTIVE",
    }).select("name currentSemester currentYear"),
  }),
);
router.post("/initialize", async (req, res) =>
  res.json(
    await transaction(async () => {
      if (await Cycle.exists({ isActive: true }))
        fail("An active cycle already exists.", 409);
      const b = req.body;
      if (
        !/^\d{4}-\d{2}$/.test(b.academicYear) ||
        !["ODD", "EVEN"].includes(b.cycleType) ||
        !b.startDate ||
        !b.endDate ||
        new Date(b.endDate) <= new Date(b.startDate)
      )
        fail("Enter a valid academic year, cycle type and date range.");
      return Cycle.create({
        academicYear: b.academicYear,
        cycleType: b.cycleType,
        startDate: b.startDate,
        endDate: b.endDate,
        isActive: true,
      });
    }),
  ),
);
router.post("/advance", async (req, res) =>
  res.json(
    await transaction(async () => {
      const cycle = await Cycle.findOne({
        _id: req.body.cycleId,
        isActive: true,
      });
      if (!cycle) fail("Cycle changed. Refresh before advancing.", 409);
      const students = await User.find({
        role: "student",
        status: "ACTIVE",
        academicStatus: "ACTIVE",
      });
      let advanced = 0,
        completed = 0,
        skipped = 0;
      for (const student of students) {
        const sem = student.currentSemester;
        if (!sem) {
          skipped++;
          continue;
        }
        if (sem === 8) {
          student.academicStatus = "COMPLETED";
          student.status = "ALUMNI";
          student.graduatedAt = new Date();
          student.sectionId = null;
          completed++;
        } else {
          student.currentSemester = sem + 1;
          student.currentYear = Math.ceil((sem + 1) / 2);
          student.sectionId = null;
          advanced++;
        }
        await student.save();
        await Session.deleteMany({ userId: student._id });
      }
      cycle.isActive = false;
      await cycle.save();
      let academicYear = cycle.academicYear;
      if (cycle.cycleType === "EVEN") {
        const start = Number(academicYear.slice(0, 4)) + 1;
        academicYear = `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
      }
      const startDate = new Date(),
        endDate = new Date();
      endDate.setMonth(endDate.getMonth() + 5);
      const nextCycle = await Cycle.create({
        academicYear,
        cycleType: cycle.cycleType === "ODD" ? "EVEN" : "ODD",
        startDate,
        endDate,
        isActive: true,
      });
      return {
        nextCycle,
        advanced,
        completed,
        skipped,
        message:
          "Cycle advanced. Assign promoted students to their new sections.",
      };
    }),
  ),
);
module.exports = router;
