import mongoose, { Schema } from "mongoose";

const DepartmentSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
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

const Department =
  mongoose.models.Department ||
  mongoose.model("Department", DepartmentSchema);

export default Department;
