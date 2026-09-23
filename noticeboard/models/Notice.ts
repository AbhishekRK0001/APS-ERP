import mongoose, { Schema } from "mongoose";

const AttachmentSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
    },

    url: {
      type: String,
      required: true,
    },

    mimeType: {
      type: String,
      default: null,
    },

    size: {
      type: Number,
      default: null,
    },
  },
  {
    _id: false,
  }
);

const NoticeSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      required: true,
      trim: true,
    },

    type: {
      type: String,
      enum: [
        "GENERAL",
        "IMPORTANT",
        "EVENT",
        "ASSIGNMENT_REMINDER",
        "TEST",
        "EXAM",
      ],
      default: "GENERAL",
    },

    category: {
      type: String,
      enum: [
        "GENERAL",
        "ACADEMIC",
        "TECHNICAL",
        "CULTURAL",
        "SPORTS",
        "PLACEMENT",
        "CLUB",
        "DEPARTMENT",
      ],
      default: "GENERAL",
    },

    postStyle: {
      type: String,
      enum: [
        "NOTICE",
        "ANNOUNCEMENT",
        "EVENT",
        "POSTER",
      ],
      default: "NOTICE",
    },

    priority: {
      type: String,
      enum: [
        "LOW",
        "NORMAL",
        "HIGH",
        "URGENT",
      ],
      default: "NORMAL",
    },

    scope: {
      type: String,
      enum: [
        "COLLEGE",
        "DEPARTMENT",
        "SECTION",
      ],
      required: true,
    },

    departmentId: {
      type: Schema.Types.ObjectId,
      ref: "Department",
      default: null,
    },

    sectionId: {
      type: Schema.Types.ObjectId,
      ref: "Section",
      default: null,
    },

    targetYear: {
      type: Number,
      min: 1,
      max: 4,
      default: null,
    },

    targetSemester: {
      type: Number,
      min: 1,
      max: 8,
      default: null,
    },

    postedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    publishAt: {
      type: Date,
      default: Date.now,
    },

    expiresAt: {
      type: Date,
      default: null,
    },

    dueDate: {
      type: Date,
      default: null,
    },

    eventDate: {
      type: Date,
      default: null,
    },

    registrationDeadline: {
      type: Date,
      default: null,
    },

    actionLabel: {
      type: String,
      enum: [
        "REGISTER",
        "APPLY",
        "JOIN",
        "VIEW_DETAILS",
        "DOWNLOAD",
        "NONE",
      ],
      default: "NONE",
    },

    actionUrl: {
      type: String,
      default: null,
      trim: true,
    },

    attachments: {
      type: [AttachmentSchema],
      default: [],
    },

    showInFeed: {
      type: Boolean,
      default: true,
    },

    showInTicker: {
      type: Boolean,
      default: false,
    },

    isPinned: {
      type: Boolean,
      default: false,
    },

    isPublished: {
      type: Boolean,
      default: true,
    },

    requiresApproval: {
      type: Boolean,
      default: false,
    },

    approvalStatus: {
      type: String,
      enum: [
        "NOT_REQUIRED",
        "PENDING",
        "APPROVED",
        "REJECTED",
      ],
      default: "NOT_REQUIRED",
    },

    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    approvedAt: {
      type: Date,
      default: null,
    },

    rejectedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    rejectedAt: {
      type: Date,
      default: null,
    },

    rejectionReason: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

NoticeSchema.index({
  category: 1,
  scope: 1,
  isPublished: 1,
});

NoticeSchema.index({
  registrationDeadline: 1,
});

NoticeSchema.index({
  dueDate: 1,
});

const Notice =
  mongoose.models.Notice ||
  mongoose.model(
    "Notice",
    NoticeSchema
  );

export default Notice;
