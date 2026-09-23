import mongoose, { Schema } from "mongoose";

const AcademicCycleSchema = new Schema(
  {
    academicYear: {
      type: String,
      required: true,
      trim: true,
    },

    cycleType: {
      type: String,
      enum: ["ODD", "EVEN"],
      required: true,
    },

    startDate: {
      type: Date,
      required: true,
    },

    endDate: {
      type: Date,
      required: true,
    },

    isActive: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

const AcademicCycle =
  mongoose.models.AcademicCycle ||
  mongoose.model("AcademicCycle", AcademicCycleSchema);

export default AcademicCycle;
