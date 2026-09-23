import { NextResponse } from "next/server";

import { connectDB } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { buildRelevantNoticeQuery } from "@/lib/noticeAccess";

import User from "@/models/User";
import Notice from "@/models/Notice";
import NotificationRead from "@/models/NotificationRead";

export async function POST(
  request: Request
) {
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
          message:
            "User not found.",
        },
        {
          status: 404,
        }
      );
    }

    const body =
      await request.json();

    const now =
      new Date();

    const relevantQuery =
      buildRelevantNoticeQuery(
        user,
        now
      );

    if (body.all === true) {
      const notices =
        await Notice.find(
          relevantQuery
        )
          .select("_id")
          .limit(100)
          .lean();

      if (
        notices.length > 0
      ) {
        await NotificationRead.bulkWrite(
          notices.map(
            (notice: any) => ({
              updateOne: {
                filter: {
                  userId:
                    user._id,

                  noticeId:
                    notice._id,
                },

                update: {
                  $set: {
                    readAt:
                      new Date(),
                  },
                },

                upsert:
                  true,
              },
            })
          )
        );
      }

      return NextResponse.json({
        success: true,
      });
    }

    const noticeId =
      String(
        body.noticeId || ""
      );

    if (!noticeId) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Notice ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    const notice =
      await Notice.findOne({
        $and: [
          relevantQuery,
          {
            _id:
              noticeId,
          },
        ],
      });

    if (!notice) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Notification not found.",
        },
        {
          status: 404,
        }
      );
    }

    await NotificationRead.updateOne(
      {
        userId:
          user._id,

        noticeId:
          notice._id,
      },

      {
        $set: {
          readAt:
            new Date(),
        },
      },

      {
        upsert:
          true,
      }
    );

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error(
      "Notification read error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Unable to update notification.",
      },
      {
        status: 500,
      }
    );
  }
}
