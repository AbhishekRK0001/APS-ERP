const mongoose = require("mongoose");

const staffSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  name: String,
  department: String,
  section: String, // ✅ ADD THIS
  designation: {
    type: String,
    enum: ["PRINCIPAL", "HOD", "CLASS_TEACHER", "TEACHER"]
  }
});

module.exports = mongoose.model("Staff", staffSchema);