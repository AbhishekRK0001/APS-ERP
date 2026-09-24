const Teacher = require("../../timetable/server/models/Teacher");
const Timetable = require("../../timetable/server/models/Timetable");
const {
  getEntries,
  normalizeGrid,
} = require("../../timetable/server/services/generator");
const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const TIMES = [
  ["09:00", "09:50"],
  ["09:50", "10:40"],
  null,
  ["11:00", "11:50"],
  ["11:50", "12:40"],
  null,
  ["13:20", "14:10"],
  ["14:10", "15:00"],
  ["15:00", "15:50"],
];
function project(timetables, teacherId) {
  const days = DAYS.map((dayOfWeek) => ({ dayOfWeek, periods: [] }));
  for (const tt of timetables)
    normalizeGrid(tt.grid).forEach((row, day) =>
      row.forEach((cell, slot) => {
        if (!TIMES[slot]) return;
        const matches = getEntries(cell).filter(
          (x) => String(x.teacherId) === String(teacherId),
        );
        if (!matches.length) return;
        days[day].periods.push({
          periodNumber: slot + 1,
          subject: [
            ...new Set(
              matches.map((x) => x.subjectName || x.subjectCode || "Class"),
            ),
          ].join(" / "),
          className: String(tt.sectionId?._id || tt.sectionId),
          classLabel: tt.sectionId?.name || "Section",
          startTime: TIMES[slot][0],
          endTime: TIMES[slot][1],
          validFrom: tt.workingPeriod?.startDate,
          validTo: tt.workingPeriod?.endDate,
        });
      }),
    );
  return { days };
}
async function load(teacher, session = null) {
  const profile = await Teacher.findOne({ userId: teacher }).session(session);
  if (!profile) return null;
  const tables = await Timetable.find()
    .populate("sectionId")
    .session(session)
    .lean();
  return { teacher, ...project(tables, profile._id) };
}
module.exports = {
  project,
  load,
  DAYS,
  TIMES,
  findOne: ({ teacher }) => ({ session: (session) => load(teacher, session) }),
};
