import { NextResponse } from "next/server";

import { connectDB } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { buildRelevantNoticeQuery } from "@/lib/noticeAccess";

import User from "@/models/User";
import Notice from "@/models/Notice";
import Department from "@/models/Department";
import Section from "@/models/Section";

const VALID_CATEGORIES = [
  "GENERAL",
  "ACADEMIC",
  "TECHNICAL",
  "CULTURAL",
  "SPORTS",
  "PLACEMENT",
  "CLUB",
  "DEPARTMENT",
];

const VALID_CHANNELS = [
  "all",
  "college",
  "department",
  "class",
];

export async function GET(request: Request) {
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

    const url = new URL(request.url);

    const requestedCategory =
      url.searchParams
        .get("category")
        ?.toUpperCase() || "";

    const requestedChannel =
      url.searchParams
        .get("channel")
        ?.toLowerCase() || "all";

    const parsedLimit = Number(
      url.searchParams.get("limit") || 30
    );

    const limit = Math.min(
      Math.max(
        Number.isFinite(parsedLimit)
          ? parsedLimit
          : 30,
        1
      ),
      50
    );

    const now = new Date();

    const baseQuery =
      buildRelevantNoticeQuery(
        user,
        now
      );

    const conditions: Record<
      string,
      unknown
    >[] = [
      baseQuery,

      {
        $or: [
          {
            showInFeed: true,
          },
          {
            showInFeed: {
              $exists: false,
            },
          },
        ],
      },
    ];

    if (
      requestedCategory &&
      requestedCategory !== "ALL" &&
      VALID_CATEGORIES.includes(
        requestedCategory
      )
    ) {
      conditions.push({
        category:
          requestedCategory,
      });
    }

    if (
      VALID_CHANNELS.includes(
        requestedChannel
      ) &&
      requestedChannel !== "all"
    ) {
      const scopeMap = {
        college: "COLLEGE",
        department: "DEPARTMENT",
        class: "SECTION",
      } as const;

      conditions.push({
        scope:
          scopeMap[
            requestedChannel as
              | "college"
              | "department"
              | "class"
          ],
      });
    }

    const notices =
      await Notice.find({
        $and: conditions,
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
        .limit(limit)
        .lean();

    const feed = notices.map(
      (notice: any) => ({
        id:
          notice._id.toString(),

        title:
          notice.title,

        description:
          notice.description,

        type:
          notice.type,

        category:
          notice.category ||
          "GENERAL",

        postStyle:
          notice.postStyle ||
          "NOTICE",

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
              ? notice.departmentId
                  ?.code ||
                "Department"
              : notice.sectionId
                  ?.name ||
                "Class",

        department:
          notice.departmentId
            ? {
                id:
                  notice.departmentId
                    ._id?.toString(),

                name:
                  notice.departmentId
                    .name,

                code:
                  notice.departmentId
                    .code,
              }
            : null,

        section:
          notice.sectionId
            ? {
                id:
                  notice.sectionId
                    ._id?.toString(),

                name:
                  notice.sectionId
                    .name,
              }
            : null,

        targetYear:
          notice.targetYear ||
          null,

        targetSemester:
          notice.targetSemester ||
          null,

        postedBy:
          notice.postedBy
            ? {
                id:
                  notice.postedBy
                    ._id?.toString(),

                name:
                  notice.postedBy
                    .name,

                role:
                  notice.postedBy
                    .role,
              }
            : null,

        publishAt:
          notice.publishAt,

        dueDate:
          notice.dueDate ||
          null,

        eventDate:
          notice.eventDate ||
          null,

        registrationDeadline:
          notice.registrationDeadline ||
          null,

        actionLabel:
          notice.actionLabel ||
          "NONE",

        actionUrl:
          notice.actionUrl ||
          null,

        attachments:
          notice.attachments ||
          [],

        isPinned:
          Boolean(
            notice.isPinned
          ),
      })
    );

    return NextResponse.json({
      success: true,

      filters: {
        category:
          requestedCategory ||
          "ALL",

        channel:
          requestedChannel,
      },

      count:
        feed.length,

      feed,
    });
  } catch (error) {
    console.error(
      "Campus feed error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Unable to load campus feed.",
      },
      {
        status: 500,
      }
    );
  }
}
