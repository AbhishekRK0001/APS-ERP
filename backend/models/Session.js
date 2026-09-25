const mongoose = require("mongoose");
module.exports = mongoose.model(
  "Session",
  new mongoose.Schema(
    {
      hash: { type: String, unique: true },
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
      expiresAt: { type: Date, index: { expires: 0 } },
    },
    { timestamps: true },
  ),
);
