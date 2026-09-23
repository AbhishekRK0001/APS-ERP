const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  usn: {
    type: String,
    required: true,
    unique: true
  },
  email: {
    type: String,
    unique: true,
    sparse: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: [
      "SUPER_ADMIN",
      "ADMIN",
      "PRINCIPAL",
      "HOD",
      "CLASS_TEACHER",
      "TEACHER",
      "STUDENT"
    ],
    required: true
  },
  status: {
    type: String,
    enum: ["PENDING", "VERIFIED", "ACTIVE", "FROZEN", "ALUMNI", "TERMINATED"],
    default: "PENDING"
  },

  loginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: Date,

  // 🔴 NEW
  refreshTokens: [String],

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  }
}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);