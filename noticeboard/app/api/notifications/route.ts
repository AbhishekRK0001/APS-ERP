import { NextResponse } from "next/server";

import { connectDB } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { buildRelevantNoticeQuery } from "@/lib/noticeAccess";

import User from "@/models/User";
import Notice from "@/models/Notice";
import Department from "@/models/Department";
import Section from "@/models/Section";
import NotificationRead from "@/models/NotificationRead";

export async function GET() {
  try {
    const session = await getSession();

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

    const user = await User.findById(
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

    const now = new Date();

    const notices = await Notice.find(
      buildRelevantNoticeQuery(
        user,
        now
      )
    )
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
        publishAt: -1,
        createdAt: -1,
      })
      .limit(40)
      .lean();

    const noticeIds =
      notices.map(
        (notice: any) =>
          notice._id
      );

    const reads =
      await NotificationRead.find({
        userId: user._id,

        noticeId: {
          $in: noticeIds,
        },
      })
        .select("noticeId")
        .lean();

    const readIds =
      new Set(
        reads.map((item: any) =>
          item.noticeId.toString()
        )
      );

    const notifications =
      notices.map(
        (notice: any) => {
          const id =
            notice._id.toString();

          let audience =
            "College";

          if (
            notice.scope ===
            "DEPARTMENT"
          ) {
            audience =
              notice.departmentId
                ?.code ||
              "Department";
          }

          if (
            notice.scope ===
            "SECTION"
          ) {
            audience =
              notice.sectionId
                ?.name ||
              "Class";
          }

          return {
            id,

            title:
              notice.title,

            description:
              notice.description,

            category:
              notice.category ||
              "GENERAL",

            priority:
              notice.priority,

            audience,

            publishedAt:
              notice.publishAt,

            postedBy:
              notice.postedBy
                ?.name ||
              "College Administration",

            isRead:
              readIds.has(id),

            hasDeadline:
              Boolean(
                notice.dueDate ||
                notice.registrationDeadline
              ),
          };
        }
      );

    const unreadCount =
      notifications.filter(
        (item) =>
          !item.isRead
      ).length;

    return NextResponse.json({
      success: true,
      unreadCount,
      notifications,
    });
  } catch (error) {
    console.error(
      "Notifications error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Unable to load notifications.",
      },
      {
        status: 500,
      }
    );
  }
}
