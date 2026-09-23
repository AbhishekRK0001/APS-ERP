import { NextResponse } from "next/server";

import { connectDB } from "@/lib/db";
import { getSession } from "@/lib/auth";

import User from "@/models/User";
import AcademicCycle from "@/models/AcademicCycle";

function getNextAcademicYear(
  academicYear: string,
  currentType: "ODD" | "EVEN"
) {
  if (currentType === "ODD") {
    return academicYear;
  }

  const match = academicYear.match(/^(\d{4})-(\d{2})$/);

  if (!match) {
    return academicYear;
  }

  const nextStartYear = Number(match[1]) + 1;
  const nextEndYear = String(
    (nextStartYear + 1) % 100
  ).padStart(2, "0");

  return `${nextStartYear}-${nextEndYear}`;
}

export async function POST(request: Request) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized.",
        },
        { status: 401 }
      );
    }

    if (
      !["PRINCIPAL", "ADMIN"].includes(
        session.role
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Only Principal or Admin can advance the academic cycle.",
        },
        { status: 403 }
      );
    }

    const body = await request.json();

    const expectedCycleId =
      String(body.cycleId || "");

    if (!expectedCycleId) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Current academic cycle is required.",
        },
        { status: 400 }
      );
    }

    await connectDB();

    const activeCycle =
      await AcademicCycle.findOne({
        isActive: true,
      });

    if (!activeCycle) {
      return NextResponse.json(
        {
          success: false,
          message:
            "No active academic cycle found.",
        },
        { status: 404 }
      );
    }

    if (
      activeCycle._id.toString() !==
      expectedCycleId
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Academic cycle changed. Refresh the page before continuing.",
        },
        { status: 409 }
      );
    }

    const students = await User.find({
      role: "STUDENT",
      isActive: true,
      academicStatus: {
        $ne: "COMPLETED",
      },
    });

    let advanced = 0;
    let completed = 0;
    let skipped = 0;

    for (const student of students) {
      const semester =
        student.currentSemester;

      if (
        !semester ||
        semester < 1 ||
        semester > 8
      ) {
        skipped++;
        continue;
      }

      if (semester === 8) {
        student.academicStatus =
          "COMPLETED";

        student.graduatedAt =
          new Date();

        completed++;
      } else {
        student.currentSemester =
          semester + 1;

        if ([2, 4, 6].includes(semester)) {
          student.currentYear =
            Math.min(
              (student.currentYear || 1) + 1,
              4
            );
        }

        advanced++;
      }

      await student.save();
    }

    activeCycle.isActive = false;

    await activeCycle.save();

    const nextType =
      activeCycle.cycleType === "ODD"
        ? "EVEN"
        : "ODD";

    const nextAcademicYear =
      getNextAcademicYear(
        activeCycle.academicYear,
        activeCycle.cycleType
      );

    const startDate =
      new Date();

    const endDate =
      new Date(startDate);

    endDate.setMonth(
      endDate.getMonth() + 5
    );

    const nextCycle =
      await AcademicCycle.create({
        academicYear:
          nextAcademicYear,

        cycleType:
          nextType,

        startDate,
        endDate,

        isActive:
          true,
      });

    return NextResponse.json({
      success: true,

      message:
        "Academic cycle advanced successfully.",

      advanced,
      completed,
      skipped,

      nextCycle: {
        id:
          nextCycle._id.toString(),

        academicYear:
          nextCycle.academicYear,

        cycleType:
          nextCycle.cycleType,
      },
    });
  } catch (error) {
    console.error(
      "Academic cycle advancement error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Unable to advance academic cycle.",
      },
      { status: 500 }
    );
  }
}
