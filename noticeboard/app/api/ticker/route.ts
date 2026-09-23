import { NextResponse } from "next/server";

import { connectDB } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { buildRelevantNoticeQuery } from "@/lib/noticeAccess";

import User from "@/models/User";
import Notice from "@/models/Notice";
import Department from "@/models/Department";
import Section from "@/models/Section";

function getHeadline(
  notice: any
) {
  if (
    notice.registrationDeadline
  ) {
    return `${notice.title} — registration closes soon`;
  }

  if (notice.dueDate) {
    return `${notice.title} — deadline approaching`;
  }

  return notice.title;
}

function getDeadlineType(
  notice: any
) {
  if (
    notice.registrationDeadline
  ) {
    return "REGISTRATION";
  }

  if (notice.dueDate) {
    return "DUE_DATE";
  }

  return "LIVE_UPDATE";
}

function getRelevantDate(
  notice: any
) {
  if (
    notice.registrationDeadline
  ) {
    return new Date(
      notice.registrationDeadline
    ).getTime();
  }

  if (notice.dueDate) {
    return new Date(
      notice.dueDate
    ).getTime();
  }

  return Number.MAX_SAFE_INTEGER;
}

function priorityWeight(
  priority: string
) {
  switch (priority) {
    case "URGENT":
      return 4;

    case "HIGH":
      return 3;

    case "NORMAL":
      return 2;

    case "LOW":
      return 1;

    default:
      return 0;
  }
}

export async function GET() {
  try {
    const session =
      await getSession();

    if (!session) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized.",
        },
        {
          status: 401,
        }
      );
    }

    await connectDB();

    const user =
      await User.findById(
        session.userId
      );

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: "User not found.",
        },
        {
          status: 404,
        }
      );
    }

    const now =
      new Date();

    const deadlineCutoff =
      new Date();

    deadlineCutoff.setDate(
      deadlineCutoff.getDate() +
        14
    );

    const baseQuery =
      buildRelevantNoticeQuery(
        user,
        now
      );

    const notices =
      await Notice.find({
        $and: [
          baseQuery,

          {
            $or: [
              {
                showInTicker:
                  true,
              },

              {
                registrationDeadline:
                  {
                    $gte: now,
                    $lte:
                      deadlineCutoff,
                  },
              },

              {
                dueDate: {
                  $gte: now,
                  $lte:
                    deadlineCutoff,
                },
              },
            ],
          },
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
        .limit(30)
        .lean();

    const sorted = notices.sort(
      (a: any, b: any) => {
        const priorityDifference =
          priorityWeight(
            b.priority
          ) -
          priorityWeight(
            a.priority
          );

        if (
          priorityDifference !==
          0
        ) {
          return priorityDifference;
        }

        return (
          getRelevantDate(a) -
          getRelevantDate(b)
        );
      }
    );

    const ticker =
      sorted
        .slice(0, 12)
        .map(
          (notice: any) => ({
            id:
              notice._id.toString(),

            title:
              notice.title,

            headline:
              getHeadline(
                notice
              ),

            category:
              notice.category ||
              "GENERAL",

            priority:
              notice.priority,

            scope:
              notice.scope,

            audience:
              notice.scope ===
              "COLLEGE"
                ? "College"
                : notice.scope ===
                    "DEPARTMENT"
                  ? notice
                      .departmentId
                      ?.code ||
                    "Department"
                  : notice
                      .sectionId
                      ?.name ||
                    "Class",

            deadlineType:
              getDeadlineType(
                notice
              ),

            deadline:
              notice.registrationDeadline ||
              notice.dueDate ||
              null,

            actionLabel:
              notice.actionLabel ||
              "NONE",

            actionUrl:
              notice.actionUrl ||
              null,
          })
        );

    return NextResponse.json({
      success: true,

      windowDays: 14,

      count:
        ticker.length,

      ticker,
    });
  } catch (error) {
    console.error(
      "Ticker error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Unable to load live updates.",
      },
      {
        status: 500,
      }
    );
  }
}
