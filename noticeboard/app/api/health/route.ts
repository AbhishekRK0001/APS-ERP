import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";

export async function GET() {
  try {
    await connectDB();

    return NextResponse.json({
      success: true,
      database: "connected",
      message: "College Portal API is running",
    });
  } catch (error) {
    console.error("MongoDB connection error:", error);

    return NextResponse.json(
      {
        success: false,
        database: "disconnected",
        message: "Database connection failed",
      },
      { status: 500 }
    );
  }
}
