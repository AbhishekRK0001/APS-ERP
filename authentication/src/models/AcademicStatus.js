const mongoose = require("mongoose");

const academicSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  semester: Number,
  backlogs: {
    type: Number,
    default: 0
  },
  graduated: {
    type: Boolean,
    default: false
  }
});

module.exports = mongoose.model("AcademicStatus", academicSchema);