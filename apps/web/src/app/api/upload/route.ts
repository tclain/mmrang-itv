import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll("files") as File[];

    if (files.length === 0) {
      return NextResponse.json(
        { error: "No files provided" },
        { status: 400 }
      );
    }

    // Ensure /data directory exists
    const dataDir = join(process.cwd(), "data");
    if (!existsSync(dataDir)) {
      await mkdir(dataDir, { recursive: true });
    }

    const uploadedFilenames: string[] = [];

    // Process each file
    for (const file of files) {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      // Sanitize filename to prevent directory traversal
      const sanitizedFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const filePath = join(dataDir, sanitizedFilename);

      // Write file to disk
      await writeFile(filePath, buffer);
      uploadedFilenames.push(sanitizedFilename);
    }

    return NextResponse.json({
      success: true,
      filenames: uploadedFilenames,
      message: `Successfully uploaded ${uploadedFilenames.length} file(s)`,
    });
  } catch (error) {
    console.error("File upload error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to upload file",
      },
      { status: 500 }
    );
  }
}

