import mongoose, { Schema } from "mongoose";

const UserSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    collegeId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },

    passwordHash: {
      type: String,
      required: true,
    },

    role: {
      type: String,
      enum: ["STUDENT", "TEACHER", "HOD", "PRINCIPAL", "ADMIN"],
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

    assignedSectionIds: [
      {
        type: Schema.Types.ObjectId,
        ref: "Section",
      },
    ],

    batchStartYear: {
      type: Number,
      default: null,
    },

    batchEndYear: {
      type: Number,
      default: null,
    },

    currentYear: {
      type: Number,
      min: 1,
      max: 4,
      default: null,
    },

    currentSemester: {
      type: Number,
      min: 1,
      max: 8,
      default: null,
    },

    academicStatus: {
      type: String,
      enum: ["ACTIVE", "COMPLETED"],
      default: "ACTIVE",
    },

    graduatedAt: {
      type: Date,
      default: null,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

const User =
  mongoose.models.User ||
  mongoose.model("User", UserSchema);

export default User;
