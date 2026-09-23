const mongoose = require("mongoose");

const auditSchema = new mongoose.Schema({
  actorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  targetId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  action: String,
  metadata: Object
}, { timestamps: true });

module.exports = mongoose.model("AuditLog", auditSchema);