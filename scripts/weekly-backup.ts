import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

const isFullBackup = process.argv.includes("--full");

function getLastWeekDate(): Date {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  d.setHours(0, 0, 0, 0);
  return d;
}

async function getAccessToken(): Promise<string> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Missing GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, or GOOGLE_REFRESH_TOKEN");
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
    throw new Error(`Failed to refresh access token: ${JSON.stringify(data)}`);
  }

  return data.access_token;
}

async function uploadToDrive(fileName: string, content: string) {
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!folderId) throw new Error("GOOGLE_DRIVE_FOLDER_ID env var is not set");

  const accessToken = await getAccessToken();

  const metadata = {
    name: fileName,
    parents: [folderId],
    mimeType: "application/json",
  };

  const boundary = "backup_boundary_" + Date.now();
  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: application/json\r\n\r\n` +
    `${content}\r\n` +
    `--${boundary}--`;

  const res = await fetch(
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

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Drive upload failed (${res.status}): ${err}`);
  }

  return res.json();
}

async function fetchTickets(since: Date | null) {
  const where = since ? { updatedAt: { gte: since } } : {};

  const tickets = await prisma.ticket.findMany({
    where,
    include: {
      creator: { select: { id: true, name: true, email: true } },
      manager: { select: { id: true, name: true, email: true } },
      events: {
        include: { user: { select: { id: true, name: true } } },
        orderBy: { createdAt: "asc" },
      },
      comments: {
        include: { author: { select: { id: true, name: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return tickets;
}

async function main() {
  const now = new Date();
  const dateStr = now.toISOString().split("T")[0];

  let since: Date | null = null;
  let filePrefix: string;

  if (isFullBackup) {
    console.log("Running FULL backup of all tickets...");
    filePrefix = "tickets-full-backup";
  } else {
    since = getLastWeekDate();
    console.log(`Fetching tickets changed since ${since.toISOString()}...`);
    filePrefix = "tickets-weekly-backup";
  }

  const tickets = await fetchTickets(since);

  if (tickets.length === 0) {
    console.log("No tickets to back up. Skipping.");
    return;
  }

  const backup = {
    type: isFullBackup ? "full" : "weekly",
    generatedAt: now.toISOString(),
    periodFrom: since?.toISOString() ?? "all-time",
    periodTo: now.toISOString(),
    ticketCount: tickets.length,
    note: isFullBackup
      ? "Full backup — contains all tickets and their complete history."
      : "Weekly backup — contains only tickets created or modified since periodFrom. To reconstruct full state, start from the latest full backup and apply weekly backups in order, keeping the newest version of each ticket by ID.",
    tickets,
  };

  const content = JSON.stringify(backup, null, 2);
  const fileName = `${filePrefix}-${dateStr}.json`;

  // Save locally as artifact
  const outDir = path.join(process.cwd(), "backup-output");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, fileName), content, "utf-8");

  // Upload to Google Drive
  console.log(`Uploading ${fileName} (${tickets.length} tickets)...`);
  const file = await uploadToDrive(fileName, content);

  console.log(`Backup uploaded successfully.`);
  console.log(`  File: ${file.name}`);
  console.log(`  Link: ${file.webViewLink}`);
}

main()
  .catch((e) => {
    console.error("Backup failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
