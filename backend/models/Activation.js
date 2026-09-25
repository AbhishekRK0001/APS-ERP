const mongoose = require("mongoose");
module.exports = mongoose.model(
  "Activation",
  new mongoose.Schema(
    {
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        unique: true,
      },
      hash: String,
      attempts: { type: Number, default: 0 },
      expiresAt: { type: Date, index: { expires: 0 } },
    },
    { timestamps: true },
  ),
);
