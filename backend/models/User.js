const mongoose = require("mongoose");
const { Schema } = mongoose;
const roles = [
  "super_admin",
  "admin",
  "principal",
  "hod",
  "class_teacher",
  "teacher",
  "student",
];
const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    usn: { type: String, unique: true, sparse: true, trim: true },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: roles, required: true },
    status: {
      type: String,
      enum: ["PENDING", "ACTIVE", "FROZEN", "ALUMNI", "TERMINATED"],
      default: "PENDING",
    },
    departmentId: {
      type: Schema.Types.ObjectId,
      ref: "Department",
      default: null,
    },
    sectionId: { type: Schema.Types.ObjectId, ref: "Section", default: null },
    assignedSectionIds: [{ type: Schema.Types.ObjectId, ref: "Section" }],
    currentSemester: { type: Number, min: 1, max: 8 },
    currentYear: { type: Number, min: 1, max: 4 },
    academicStatus: {
      type: String,
      enum: ["ACTIVE", "COMPLETED"],
      default: "ACTIVE",
    },
    graduatedAt: Date,
    firstHalfTotal: { type: Number, default: 7 },
    firstHalfUsed: { type: Number, default: 0 },
    secondHalfTotal: { type: Number, default: 8 },
    secondHalfUsed: { type: Number, default: 0 },
    privilegedLeaves: { type: Number, default: 0 },
    loginAttempts: { type: Number, default: 0 },
    lockUntil: Date,
    workflowRevision: { type: Number, default: 0, select: false },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);
module.exports = mongoose.models.User || mongoose.model("User", userSchema);
module.exports.roles = roles;
