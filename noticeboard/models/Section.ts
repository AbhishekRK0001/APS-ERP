import mongoose, { Schema } from "mongoose";

const SectionSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    departmentId: {
      type: Schema.Types.ObjectId,
      ref: "Department",
      required: true,
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

const Section =
  mongoose.models.Section ||
  mongoose.model("Section", SectionSchema);

export default Section;
