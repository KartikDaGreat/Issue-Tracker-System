import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Role } from "@prisma/client";

async function getAccessToken(): Promise<string> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Google Drive credentials not configured");
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const data = await res.json();
  if (!data.access_token) {
    throw new Error("Failed to refresh Google access token");
  }

  return data.access_token;
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== Role.ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const folderId = process.env.GOOGLE_DRIVE_REPORTS_FOLDER_ID;
  if (!folderId) {
    return NextResponse.json({ error: "Google Drive reports folder not configured" }, { status: 500 });
  }

  const pdfBuffer = await req.arrayBuffer();
  if (!pdfBuffer.byteLength) {
    return NextResponse.json({ error: "No PDF data received" }, { status: 400 });
  }

  const dateStr = new Date().toISOString().split("T")[0];
  const fileName = `inventory-report-${dateStr}.pdf`;

  let accessToken: string;
  try {
    accessToken = await getAccessToken();
  } catch {
    return NextResponse.json({ error: "Google Drive credentials not configured. Check server environment variables." }, { status: 500 });
  }

  const metadata = {
    name: fileName,
    parents: [folderId],
    mimeType: "application/pdf",
  };

  const boundary = "report_boundary_" + Date.now();
  const metaJson = JSON.stringify(metadata);

  const encoder = new TextEncoder();
  const pdfBytes = new Uint8Array(pdfBuffer);

  const prefix = encoder.encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metaJson}\r\n--${boundary}\r\nContent-Type: application/pdf\r\n\r\n`
  );
  const suffix = encoder.encode(`\r\n--${boundary}--`);

  const body = new Uint8Array(prefix.length + pdfBytes.length + suffix.length);
  body.set(prefix, 0);
  body.set(pdfBytes, prefix.length);
  body.set(suffix, prefix.length + pdfBytes.length);

  const uploadRes = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  );

  if (!uploadRes.ok) {
    const err = await uploadRes.text();
    return NextResponse.json({ error: `Drive upload failed: ${err}` }, { status: 500 });
  }

  const file = await uploadRes.json();
  return NextResponse.json({ name: file.name, link: file.webViewLink });
}
