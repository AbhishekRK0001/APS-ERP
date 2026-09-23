import { NextResponse } from "next/server";

import { connectDB } from "@/lib/db";
import { getSession } from "@/lib/auth";

import Notice from "@/models/Notice";
import User from "@/models/User";

export async function POST(
  request: Request,
  context: {
    params: Promise<{
      id: string;
    }>;
  }
) {
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
      !["HOD", "PRINCIPAL", "ADMIN"].includes(
        session.role
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "You do not have approval permission.",
        },
        { status: 403 }
      );
    }

    await connectDB();

    const { id } = await context.params;

    const [currentUser, notice] =
      await Promise.all([
        User.findById(session.userId),
        Notice.findById(id),
      ]);

    if (!currentUser || !notice) {
      return NextResponse.json(
        {
          success: false,
          message: "Notice not found.",
        },
        { status: 404 }
      );
    }

    if (notice.approvalStatus !== "PENDING") {
      return NextResponse.json(
        {
          success: false,
          message:
            "This notice is no longer pending approval.",
        },
        { status: 400 }
      );
    }

    // HOD can approve only notices from own department.
    if (
      session.role === "HOD" &&
      notice.departmentId?.toString() !==
        currentUser.departmentId?.toString()
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "You cannot approve notices from another department.",
        },
        { status: 403 }
      );
    }

    const body = await request.json();

    const action = String(body.action || "");
    const reason = String(
      body.reason || ""
    ).trim();

    if (action === "APPROVE") {
      notice.approvalStatus = "APPROVED";
      notice.isPublished = true;
      notice.approvedBy = currentUser._id;
      notice.approvedAt = new Date();
      notice.publishAt = new Date();

      notice.rejectedBy = null;
      notice.rejectedAt = null;
      notice.rejectionReason = null;

      await notice.save();

      return NextResponse.json({
        success: true,
        message: "Notice approved and published.",
      });
    }

    if (action === "REJECT") {
      notice.approvalStatus = "REJECTED";
      notice.isPublished = false;
      notice.rejectedBy = currentUser._id;
      notice.rejectedAt = new Date();
      notice.rejectionReason =
        reason || "Rejected by HOD.";

      await notice.save();

      return NextResponse.json({
        success: true,
        message: "Notice rejected.",
      });
    }

    return NextResponse.json(
      {
        success: false,
        message: "Invalid approval action.",
      },
      { status: 400 }
    );
  } catch (error) {
    console.error("Approval error:", error);

    return NextResponse.json(
      {
        success: false,
        message:
          "Unable to process approval request.",
      },
      { status: 500 }
    );
  }
}
