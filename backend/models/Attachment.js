const mongoose = require("mongoose");
module.exports = mongoose.model(
  "Attachment",
  new mongoose.Schema(
    {
      name: String,
      storedName: String,
      mimeType: String,
      size: Number,
      owner: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    },
    { timestamps: true },
  ),
);
