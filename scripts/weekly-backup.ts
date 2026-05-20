import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { google } from "googleapis";
import { Readable } from "stream";

const prisma = new PrismaClient();

function getLastWeekDate(): Date {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  d.setHours(0, 0, 0, 0);
  return d;
}

async function getGoogleDrive() {
  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!keyJson) throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY env var is not set");

  const key = JSON.parse(keyJson);
  const auth = new google.auth.GoogleAuth({
    credentials: key,
    scopes: ["https://www.googleapis.com/auth/drive.file"],
  });

  return google.drive({ version: "v3", auth });
}

async function fetchChangedTickets(since: Date) {
  const tickets = await prisma.ticket.findMany({
    where: { updatedAt: { gte: since } },
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

async function uploadToDrive(fileName: string, content: string) {
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!folderId) throw new Error("GOOGLE_DRIVE_FOLDER_ID env var is not set");

  const drive = await getGoogleDrive();

  const fileStream = Readable.from(Buffer.from(content, "utf-8"));

  const res = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [folderId],
      mimeType: "application/json",
    },
    media: {
      mimeType: "application/json",
      body: fileStream,
    },
    fields: "id, name, webViewLink",
  });

  return res.data;
}

async function main() {
  const since = getLastWeekDate();
  const now = new Date();
  const dateStr = now.toISOString().split("T")[0];

  console.log(`Fetching tickets updated since ${since.toISOString()}...`);

  const tickets = await fetchChangedTickets(since);

  if (tickets.length === 0) {
    console.log("No tickets changed since last week. Skipping backup.");
    return;
  }

  const backup = {
    generatedAt: now.toISOString(),
    periodFrom: since.toISOString(),
    periodTo: now.toISOString(),
    ticketCount: tickets.length,
    tickets,
  };

  const content = JSON.stringify(backup, null, 2);
  const fileName = `tickets-backup-${dateStr}.json`;

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
