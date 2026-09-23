import { NextResponse } from "next/server";

import { connectDB } from "@/lib/db";
import { getSession } from "@/lib/auth";

import Notice from "@/models/Notice";
import User from "@/models/User";
import Section from "@/models/Section";
import Department from "@/models/Department";

export async function GET() {
  try {
    await connectDB();

    const now = new Date();

    const notices = await Notice.find({
      isPublished: true,
      publishAt: { $lte: now },

      $or: [
        { expiresAt: null },
        { expiresAt: { $gt: now } },
      ],
    })
      .populate({
        path: "postedBy",
        select: "name role",
        model: User,
      })
      .populate({
        path: "departmentId",
        select: "name code",
        model: Department,
      })
      .populate({
        path: "sectionId",
        select: "name",
        model: Section,
      })
      .sort({
        isPinned: -1,
        publishAt: -1,
        createdAt: -1,
      })
      .lean();

    return NextResponse.json({
      success: true,
      count: notices.length,
      notices,
    });
  } catch (error) {
    console.error("Failed to fetch notices:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to fetch notices.",
      },
      { status: 500 }
    );
  }
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

    await connectDB();

    const user = await User.findById(session.userId);

    if (!user || !user.isActive) {
      return NextResponse.json(
        {
          success: false,
          message: "User not found.",
        },
        { status: 401 }
      );
    }

    if (
      !["TEACHER", "HOD", "PRINCIPAL", "ADMIN"].includes(
        user.role
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "You do not have permission to create notices.",
        },
        { status: 403 }
      );
    }

    const body = await request.json();

    const title = String(body.title || "").trim();
    const description = String(
      body.description || ""
    ).trim();

    const scope = String(body.scope || "");
    const type = String(body.type || "GENERAL");

    if (!title || !description || !scope) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Title, description and audience are required.",
        },
        { status: 400 }
      );
    }

    let departmentId = body.departmentId || null;
    let sectionId = body.sectionId || null;

    // Teacher permissions
    if (user.role === "TEACHER") {
      if (scope !== "SECTION" || !sectionId) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Teachers can publish only to assigned classes.",
          },
          { status: 403 }
        );
      }

      const allowed = (
        user.assignedSectionIds || []
      ).some(
        (id: { toString(): string }) =>
          id.toString() === sectionId
      );

      if (!allowed) {
        return NextResponse.json(
          {
            success: false,
            message:
              "You are not assigned to this class.",
          },
          { status: 403 }
        );
      }

      const section = await Section.findById(sectionId);

      if (!section) {
        return NextResponse.json(
          {
            success: false,
            message: "Section not found.",
          },
          { status: 404 }
        );
      }

      departmentId = section.departmentId;
    }

    // HOD permissions
    if (user.role === "HOD") {
      if (scope === "COLLEGE") {
        return NextResponse.json(
          {
            success: false,
            message:
              "HOD cannot publish college-wide notices.",
          },
          { status: 403 }
        );
      }

      departmentId = user.departmentId;

      if (scope === "SECTION") {
        const section = await Section.findById(sectionId);

        if (
          !section ||
          section.departmentId.toString() !==
            user.departmentId?.toString()
        ) {
          return NextResponse.json(
            {
              success: false,
              message:
                "That section does not belong to your department.",
            },
            { status: 403 }
          );
        }
      }
    }

    // College-wide notices
    if (scope === "COLLEGE") {
      if (
        !["PRINCIPAL", "ADMIN"].includes(user.role)
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "College-wide notices require Principal or Admin permission.",
          },
          { status: 403 }
        );
      }

      departmentId = null;
      sectionId = null;
    }

    // Teacher TEST / EXAM requires HOD approval.
    const teacherRequestedApproval =
  Boolean(body.requestApproval);

const requiresApproval =
  user.role === "TEACHER" &&
  (
    ["TEST", "EXAM"].includes(type) ||
    teacherRequestedApproval
  );
    const notice = await Notice.create({
      attachments:
  Array.isArray(body.attachments)
    ? body.attachments
    : [],
      title,
      description,

      type,
      category:
  body.category || "GENERAL",

postStyle:
  body.postStyle || "NOTICE",
      priority: body.priority || "NORMAL",

      scope,

      departmentId,
      sectionId,

      targetYear: body.targetYear
        ? Number(body.targetYear)
        : null,

      targetSemester: body.targetSemester
        ? Number(body.targetSemester)
        : null,

      dueDate: body.dueDate
        ? new Date(body.dueDate)
        : null,
        eventDate:
  body.eventDate
    ? new Date(body.eventDate)
    : null,

registrationDeadline:
  body.registrationDeadline
    ? new Date(
        body.registrationDeadline
      )
    : null,

actionLabel:
  body.actionLabel || "NONE",

actionUrl:
  body.actionUrl
    ? String(body.actionUrl).trim()
    : null,
    showInFeed:
  body.showInFeed !== false,

showInTicker:
  Boolean(body.showInTicker),

      expiresAt: body.expiresAt
        ? new Date(body.expiresAt)
        : null,

      isPinned: Boolean(body.isPinned),

      postedBy: user._id,

      requiresApproval,

      approvalStatus: requiresApproval
        ? "PENDING"
        : "NOT_REQUIRED",

      isPublished: !requiresApproval,
    });

    return NextResponse.json(
      {
        success: true,

        message: requiresApproval
          ? "Notice submitted for HOD approval."
          : "Notice published successfully.",

        requiresApproval,

        notice,
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error("Create notice error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to create notice.",
      },
      { status: 500 }
    );
  }
}
