import { NextResponse } from "next/server";

import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

import { getSession } from "@/lib/auth";

export const runtime = "nodejs";

const MAX_SIZE = 8 * 1024 * 1024;

const ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];

export async function POST(
  request: Request
) {
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

    if (
      ![
        "TEACHER",
        "HOD",
        "PRINCIPAL",
        "ADMIN",
      ].includes(session.role)
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "You cannot upload notice attachments.",
        },
        {
          status: 403,
        }
      );
    }

    const formData =
      await request.formData();

    const file =
      formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          success: false,
          message: "No file selected.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !ALLOWED_TYPES.includes(file.type)
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Only PDF, JPG, PNG and WEBP files are allowed.",
        },
        {
          status: 400,
        }
      );
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        {
          success: false,
          message:
            "File must be smaller than 8 MB.",
        },
        {
          status: 400,
        }
      );
    }

    const extension =
      path.extname(file.name);

    const storedName =
      `${Date.now()}-${randomUUID()}${extension}`;

    const uploadDirectory =
      path.join(
        process.cwd(),
        "public",
        "uploads",
        "notices"
      );

    await mkdir(
      uploadDirectory,
      {
        recursive: true,
      }
    );

    const bytes =
      await file.arrayBuffer();

    await writeFile(
      path.join(
        uploadDirectory,
        storedName
      ),

      Buffer.from(bytes)
    );

    return NextResponse.json({
      success: true,

      attachment: {
        name: file.name,

        url:
          `/uploads/notices/${storedName}`,

        mimeType: file.type,

        size: file.size,
      },
    });
  } catch (error) {
    console.error(
      "Upload error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Unable to upload attachment.",
      },
      {
        status: 500,
      }
    );
  }
}
