const mongoose = require("mongoose");

const studentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  name: String,
  department: String,
  section: String,
  semester: Number
});

module.exports = mongoose.model("Student", studentSchema);