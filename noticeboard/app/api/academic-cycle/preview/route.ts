import { NextResponse } from "next/server";

import { connectDB } from "@/lib/db";
import { getSession } from "@/lib/auth";

import User from "@/models/User";
import AcademicCycle from "@/models/AcademicCycle";

export async function GET() {
  const session = await getSession();

  if (!session) {
    return NextResponse.json(
      { success: false, message: "Unauthorized." },
      { status: 401 }
    );
  }

  if (!["PRINCIPAL", "ADMIN"].includes(session.role)) {
    return NextResponse.json(
      { success: false, message: "Not permitted." },
      { status: 403 }
    );
  }

  await connectDB();

  const currentCycle = await AcademicCycle.findOne({
    isActive: true,
  }).lean();

  const students = await User.find({
    role: "STUDENT",
    isActive: true,
    academicStatus: { $ne: "COMPLETED" },
  })
    .select("currentYear currentSemester")
    .lean();

  const transitions = Array.from({ length: 8 }, (_, index) => {
    const semester = index + 1;

    return {
      semester,
      count: students.filter(
        (student) => student.currentSemester === semester
      ).length,
    };
  });

  return NextResponse.json({
    success: true,
    currentCycle,
    totalStudents: students.length,
    transitions,
  });
}
