const ranks = {
  student: 0,
  teacher: 1,
  class_teacher: 2,
  hod: 3,
  principal: 4,
  admin: 5,
  super_admin: 6,
};
const managers = ["super_admin", "admin", "principal"];
const editors = [...managers, "hod"];
const staff = ["teacher", "class_teacher", "hod", "principal"];
const same = (a, b) => !!a && !!b && String(a._id || a) === String(b._id || b);
const fail = (message, status = 400) => {
  throw Object.assign(new Error(message), { status });
};
function canCreate(actor, role, departmentId, sectionId) {
  if (!editors.includes(actor.role)) return false;
  if (!(role in ranks) || ranks[actor.role] <= ranks[role]) return false;
  if (managers.includes(actor.role)) return true;
  if (!same(actor.departmentId, departmentId)) return false;
  if (actor.role === "hod") return true;
  return (
    actor.role === "class_teacher" &&
    role === "student" &&
    actor.assignedSectionIds.some((s) => same(s, sectionId))
  );
}
function noticeQuery(user, now = new Date()) {
  const audience = [{ scope: "COLLEGE" }];
  if (managers.includes(user.role))
    audience.push({ scope: { $in: ["DEPARTMENT", "SECTION"] } });
  else {
    if (user.departmentId)
      audience.push({ scope: "DEPARTMENT", departmentId: user.departmentId });
    if (user.role === "hod" && user.departmentId)
      audience.push({ scope: "SECTION", departmentId: user.departmentId });
    else if (user.role === "student" && user.sectionId)
      audience.push({ scope: "SECTION", sectionId: user.sectionId });
    else if (user.assignedSectionIds?.length)
      audience.push({
        scope: "SECTION",
        sectionId: { $in: user.assignedSectionIds },
      });
  }
  const and = [
    { $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] },
    { $or: audience },
  ];
  if (user.role === "student")
    for (const [key, val] of [
      ["targetYear", user.currentYear],
      ["targetSemester", user.currentSemester],
    ])
      and.push({ $or: [{ [key]: null }, { [key]: val || null }] });
  return {
    isPublished: true,
    approvalStatus: { $in: ["NOT_REQUIRED", "APPROVED"] },
    publishAt: { $lte: now },
    $and: and,
  };
}
module.exports = {
  ranks,
  managers,
  editors,
  staff,
  same,
  fail,
  canCreate,
  noticeQuery,
};
