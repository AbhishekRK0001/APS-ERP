import mongoose, { Schema } from "mongoose";

const NotificationReadSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    noticeId: {
      type: Schema.Types.ObjectId,
      ref: "Notice",
      required: true,
      index: true,
    },

    readAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

NotificationReadSchema.index(
  {
    userId: 1,
    noticeId: 1,
  },
  {
    unique: true,
  }
);

const NotificationRead =
  mongoose.models.NotificationRead ||
  mongoose.model(
    "NotificationRead",
    NotificationReadSchema
  );

export default NotificationRead;
