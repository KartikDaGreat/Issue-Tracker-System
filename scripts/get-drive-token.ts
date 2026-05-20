/**
 * Run this once to get a Google Drive refresh token.
 *
 * Usage:
 *   npx tsx scripts/get-drive-token.ts <CLIENT_ID> <CLIENT_SECRET>
 *
 * The folder owner (vaneekumar@gmail.com) must be the one to
 * approve access in the browser that opens.
 */

import http from "http";

const clientId = process.argv[2];
const clientSecret = process.argv[3];

if (!clientId || !clientSecret) {
  console.error("Usage: npx tsx scripts/get-drive-token.ts <CLIENT_ID> <CLIENT_SECRET>");
  process.exit(1);
}

const REDIRECT_URI = "http://localhost:3333";
const SCOPE = "https://www.googleapis.com/auth/drive.file";

const authUrl =
  `https://accounts.google.com/o/oauth2/v2/auth?` +
  `client_id=${clientId}` +
  `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
  `&response_type=code` +
  `&scope=${encodeURIComponent(SCOPE)}` +
  `&access_type=offline` +
  `&prompt=consent`;

console.log("\nOpening browser for authorization...\n");
console.log("If the browser does not open, visit this URL manually:\n");
console.log(authUrl + "\n");

import("child_process").then(({ exec }) => {
  const cmd =
    process.platform === "win32" ? `start "" "${authUrl}"` :
    process.platform === "darwin" ? `open "${authUrl}"` :
    `xdg-open "${authUrl}"`;
  exec(cmd);
});

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", REDIRECT_URI);
  const code = url.searchParams.get("code");

  if (!code) {
    res.writeHead(400);
    res.end("No code received.");
    return;
  }

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    });

    const tokens = await tokenRes.json();

    if (tokens.refresh_token) {
      console.log("\n=== SUCCESS ===\n");
      console.log("Add these as GitHub repo secrets:\n");
      console.log(`  GOOGLE_CLIENT_ID = ${clientId}`);
      console.log(`  GOOGLE_CLIENT_SECRET = ${clientSecret}`);
      console.log(`  GOOGLE_REFRESH_TOKEN = ${tokens.refresh_token}`);
      console.log(`\nDo NOT share the refresh token.\n`);

      res.writeHead(200, { "Content-Type": "text/html" });
      res.end("<h2>Success! You can close this tab.</h2><p>Check your terminal for the tokens.</p>");
    } else {
      console.error("Error getting tokens:", tokens);
      res.writeHead(500);
      res.end("Failed to get refresh token. Check terminal.");
    }
  } catch (err) {
    console.error("Token exchange failed:", err);
    res.writeHead(500);
    res.end("Token exchange failed.");
  }

  server.close();
  process.exit(0);
});

server.listen(3333, () => {
  console.log("Waiting for authorization callback on http://localhost:3333 ...\n");
});
