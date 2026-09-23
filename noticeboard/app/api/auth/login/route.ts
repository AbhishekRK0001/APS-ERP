import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import { connectDB } from "@/lib/db";
import { createSessionToken } from "@/lib/auth";
import User from "@/models/User";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const identifier = String(body.identifier || "").trim();
    const password = String(body.password || "");

    if (!identifier || !password) {
      return NextResponse.json(
        {
          success: false,
          message: "College ID/email and password are required.",
        },
        {
          status: 400,
        }
      );
    }

    await connectDB();

    const user = await User.findOne({
      $or: [
        {
          email: identifier.toLowerCase(),
        },
        {
          collegeId: identifier,
        },
      ],
    });

    if (!user || !user.isActive) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid login credentials.",
        },
        {
          status: 401,
        }
      );
    }

    const passwordMatches = await bcrypt.compare(
      password,
      user.passwordHash
    );

    if (!passwordMatches) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid login credentials.",
        },
        {
          status: 401,
        }
      );
    }

    const token = await createSessionToken({
      userId: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
    });

    const response = NextResponse.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        collegeId: user.collegeId,
        role: user.role,
      },
    });

    response.cookies.set("college_session", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (error) {
    console.error("Login error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to sign in.",
      },
      {
        status: 500,
      }
    );
  }
}
