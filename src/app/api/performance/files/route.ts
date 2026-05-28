import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Role } from "@prisma/client";
import {
  getAccessToken,
  uploadFileToDrive,
  listFilesInFolder,
  createDriveFolder,
} from "@/lib/google-drive";

const PERF_FOLDER_ID = process.env.GOOGLE_DRIVE_PERFORMANCE_FOLDER_ID;

function getAcademicYear(): string {
  const now = new Date();
  // Academic year: June to May. If month >= June, it's currentYear-nextYear.
  const year = now.getMonth() >= 5 ? now.getFullYear() : now.getFullYear() - 1;
  return `${year}-${year + 1}`;
}

async function getOrCreateYearFolder(
  accessToken: string,
  parentId: string
): Promise<string> {
  const yearName = getAcademicYear();
  const files = await listFilesInFolder(accessToken, parentId);
  const existing = files.find(
    (f) =>
      f.name === yearName &&
      f.mimeType === "application/vnd.google-apps.folder"
  );
  if (existing) return existing.id;

  const folder = await createDriveFolder(accessToken, yearName, parentId);
  return folder.id;
}

// GET — list saved files for current academic year
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== Role.ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!PERF_FOLDER_ID) {
    return NextResponse.json(
      { error: "Performance folder not configured" },
      { status: 500 }
    );
  }

  try {
    const accessToken = await getAccessToken();
    const yearFolderId = await getOrCreateYearFolder(
      accessToken,
      PERF_FOLDER_ID
    );
    const files = await listFilesInFolder(accessToken, yearFolderId);

    // Only return Excel files
    const excelFiles = files.filter(
      (f) =>
        f.mimeType ===
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
        f.mimeType === "application/vnd.ms-excel" ||
        f.name.endsWith(".xlsx") ||
        f.name.endsWith(".xls") ||
        f.name.endsWith(".csv")
    );

    return NextResponse.json({
      academicYear: getAcademicYear(),
      files: excelFiles.map((f) => ({
        id: f.id,
        name: f.name,
        createdTime: f.createdTime,
      })),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to list files" },
      { status: 500 }
    );
  }
}

// POST — upload a new file with a custom name
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== Role.ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!PERF_FOLDER_ID) {
    return NextResponse.json(
      { error: "Performance folder not configured" },
      { status: 500 }
    );
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const label = formData.get("label") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const fileName = label
      ? `${label}.xlsx`
      : file.name;

    const accessToken = await getAccessToken();
    const yearFolderId = await getOrCreateYearFolder(
      accessToken,
      PERF_FOLDER_ID
    );

    const bytes = new Uint8Array(await file.arrayBuffer());
    const uploaded = await uploadFileToDrive(
      accessToken,
      bytes,
      fileName,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      yearFolderId
    );

    return NextResponse.json({
      id: uploaded.id,
      name: uploaded.name,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 }
    );
  }
}
