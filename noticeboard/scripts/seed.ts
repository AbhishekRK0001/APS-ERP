import bcrypt from "bcryptjs";
import mongoose from "mongoose";

import { connectDB } from "../lib/db";

import Department from "../models/Department";
import Section from "../models/Section";
import AcademicCycle from "../models/AcademicCycle";
import User from "../models/User";
import Notice from "../models/Notice";

async function seed() {
  await connectDB();

  console.log("Connected to MongoDB");

  // Department
  const cse = await Department.findOneAndUpdate(
    { code: "CSE" },
    {
      name: "Computer Science and Engineering",
      code: "CSE",
      isActive: true,
    },
    {
      upsert: true,
      returnDocument: "after",
    }
  );

  // Sections
  const cse1 = await Section.findOneAndUpdate(
    {
      name: "CSE 1",
      departmentId: cse._id,
    },
    {
      name: "CSE 1",
      departmentId: cse._id,
      isActive: true,
    },
    {
      upsert: true,
      returnDocument: "after",
    }
  );

  const cse2 = await Section.findOneAndUpdate(
    {
      name: "CSE 2",
      departmentId: cse._id,
    },
    {
      name: "CSE 2",
      departmentId: cse._id,
      isActive: true,
    },
    {
      upsert: true,
      returnDocument: "after",
    }
  );

  // Academic cycle
  await AcademicCycle.updateMany(
    {},
    {
      isActive: false,
    }
  );

  await AcademicCycle.findOneAndUpdate(
    {
      academicYear: "2026-27",
      cycleType: "ODD",
    },
    {
      academicYear: "2026-27",
      cycleType: "ODD",
      startDate: new Date("2026-07-01"),
      endDate: new Date("2026-12-31"),
      isActive: true,
    },
    {
      upsert: true,
      returnDocument: "after",
    }
  );

  // Passwords
  const studentPassword = await bcrypt.hash(
    "Student123!",
    12
  );

  const teacherPassword = await bcrypt.hash(
    "Teacher123!",
    12
  );

  const hodPassword = await bcrypt.hash(
    "Hod123!",
    12
  );

  const principalPassword = await bcrypt.hash(
    "Principal123!",
    12
  );

  // Student
  const student = await User.findOneAndUpdate(
    {
      email: "student@college.edu",
    },
    {
      name: "Sample Student",
      email: "student@college.edu",
      collegeId: "CSE2023001",
      passwordHash: studentPassword,

      role: "STUDENT",

      departmentId: cse._id,
      sectionId: cse2._id,

      assignedSectionIds: [],

      batchStartYear: 2023,
      batchEndYear: 2027,

      currentYear: 4,
      currentSemester: 7,

      isActive: true,
    },
    {
      upsert: true,
      returnDocument: "after",
    }
  );

  // Teacher
  const teacher = await User.findOneAndUpdate(
    {
      email: "teacher@college.edu",
    },
    {
      name: "Sample Teacher",
      email: "teacher@college.edu",
      collegeId: "FAC001",
      passwordHash: teacherPassword,

      role: "TEACHER",

      departmentId: cse._id,
      sectionId: null,

      assignedSectionIds: [cse2._id],

      isActive: true,
    },
    {
      upsert: true,
      returnDocument: "after",
    }
  );

  // HOD
  const hod = await User.findOneAndUpdate(
    {
      email: "hod@college.edu",
    },
    {
      name: "CSE HOD",
      email: "hod@college.edu",
      collegeId: "HODCSE001",
      passwordHash: hodPassword,

      role: "HOD",

      departmentId: cse._id,
      sectionId: null,

      assignedSectionIds: [],

      isActive: true,
    },
    {
      upsert: true,
      returnDocument: "after",
    }
  );

  // Principal
  const principal = await User.findOneAndUpdate(
    {
      email: "principal@college.edu",
    },
    {
      name: "College Principal",
      email: "principal@college.edu",
      collegeId: "PRINCIPAL001",
      passwordHash: principalPassword,

      role: "PRINCIPAL",

      departmentId: null,
      sectionId: null,

      assignedSectionIds: [],

      isActive: true,
    },
    {
      upsert: true,
      returnDocument: "after",
    }
  );

  // Remove only development sample notices
  await Notice.deleteMany({
    title: {
      $in: [
        "College Placement Drive",
        "CSE Department Seminar",
        "AI Assignment Reminder",
      ],
    },
  });

  // College notice
  await Notice.create({
    title: "College Placement Drive",

    description:
      "Students are requested to register for the upcoming campus placement drive.",

    type: "IMPORTANT",
    priority: "HIGH",

    scope: "COLLEGE",

    postedBy: principal._id,

    isPinned: true,
    isPublished: true,
  });

  // Department notice
  await Notice.create({
    title: "CSE Department Seminar",

    description:
      "The CSE department will conduct a technical seminar this Friday.",

    type: "EVENT",
    priority: "NORMAL",

    scope: "DEPARTMENT",

    departmentId: cse._id,

    postedBy: hod._id,

    isPublished: true,
  });

  // Class notice
  const futureDueDate = new Date();
  futureDueDate.setDate(
    futureDueDate.getDate() + 3
  );

  await Notice.create({
    title: "AI Assignment Reminder",

    description:
      "Complete the Artificial Intelligence assignment and submit it to your faculty before the deadline.",

    type: "ASSIGNMENT_REMINDER",
    priority: "HIGH",

    scope: "SECTION",

    departmentId: cse._id,
    sectionId: cse2._id,

    targetYear: 4,
    targetSemester: 7,

    postedBy: teacher._id,

    dueDate: futureDueDate,

    isPublished: true,
  });

  console.log("");
  console.log("Seed completed successfully");
  console.log("");

  console.log("Created:");
  console.log("- Department: CSE");
  console.log("- Sections: CSE 1, CSE 2");
  console.log("- Academic Cycle: 2026-27 ODD");
  console.log("- Student: student@college.edu");
  console.log("- Teacher: teacher@college.edu");
  console.log("- HOD: hod@college.edu");
  console.log("- Principal: principal@college.edu");
  console.log("- 3 sample notices");

  console.log("");
  console.log("Development login passwords:");
  console.log("Student: Student123!");
  console.log("Teacher: Teacher123!");
  console.log("HOD: Hod123!");
  console.log("Principal: Principal123!");

  await mongoose.disconnect();
}

seed().catch(async (error) => {
  console.error("Seed failed:", error);

  await mongoose.disconnect();

  process.exit(1);
});
