const Teacher = require("../../timetable/server/models/Teacher");
const Timetable = require("../../timetable/server/models/Timetable");
const Leave = require("../../leave-management/backend/models/Leave");
const Request = require("../../leave-management/backend/models/SubstituteRequest");
const W = require("../../leave-management/backend/services/leaveWorkflow");
const {
  normalizeGrid,
  getEntries,
} = require("../../timetable/server/services/generator");

// Called inside the campus transaction shared by timetable and leave writes.
// Include both old and proposed schedules: removal can invalidate coverage too.
async function assertScheduleChangeAllowed(sectionId, proposed) {
  const existing = await Timetable.find({ sectionId }).lean();
  const schedules = [...existing, ...(proposed ? [proposed] : [])];
  if (!schedules.length) return;
  const profileIds = [
    ...new Set(
      schedules
        .flatMap((t) =>
          normalizeGrid(t.grid).flatMap((row) =>
            row.flatMap((cell) =>
              getEntries(cell)
                .map((e) => e.teacherId)
                .filter(Boolean),
            ),
          ),
        )
        .map(String),
    ),
  ];
  const users = (
    await Teacher.find({ _id: { $in: profileIds } }).select("userId")
  )
    .map((t) => t.userId)
    .filter(Boolean);
  const today = new Date(new Date().toISOString().slice(0, 10));
  const overlaps = schedules.map((t) => {
    if (!t.workingPeriod?.startDate || !t.workingPeriod?.endDate) return {};
    return {
      startDate: { $lte: W.date(t.workingPeriod.endDate) },
      endDate: { $gte: W.date(t.workingPeriod.startDate) },
    };
  });
  const assignments = await Request.find({
    status: { $in: ["open", ...W.CONFIRMED] },
    $or: [
      { className: String(sectionId) },
      { substituteTeacher: { $in: users } },
    ],
  }).select("leave");
  const blocking = await Leave.findOne({
    status: { $in: W.ACTIVE },
    endDate: { $gte: today },
    $and: [
      { $or: overlaps },
      {
        $or: [
          { teacher: { $in: users } },
          { _id: { $in: assignments.map((r) => r.leave).filter(Boolean) } },
        ],
      },
    ],
  });
  if (blocking)
    W.fail(
      `This section or its teachers have an overlapping active leave application (${blocking._id}, ${blocking.status}). Resolve it in Leave Management before changing this schedule. Unrelated sections can still be saved.`,
      409,
    );
}
module.exports = { assertScheduleChangeAllowed };
