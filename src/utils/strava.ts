import fs from "fs";
import path from "path";
import {
  getStravaToken,
  saveStravaToken,
  StravaTokenData,
} from "@/utils/database";

const TOKEN_FILE = path.join(process.cwd(), "src/data/strava-token.json");

function getLegacyToken(): StravaTokenData | null {
  try {
    if (fs.existsSync(TOKEN_FILE)) {
      const data = fs.readFileSync(TOKEN_FILE, "utf-8");
      return JSON.parse(data);
    }
  } catch (err) {
    console.error("Error reading token file:", err);
  }
  return null;
}

export async function saveToken(tokenData: StravaTokenData): Promise<void> {
  await saveStravaToken(tokenData);
}

export async function getValidAccessToken(): Promise<string | null> {
  let tokenData = await getStravaToken();
  if (!tokenData) {
    tokenData = getLegacyToken();
    if (tokenData) await saveToken(tokenData);
  }

  const clientId = process.env.STRAVA_CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error("Missing STRAVA_CLIENT_ID or STRAVA_CLIENT_SECRET");
    return null;
  }

  // Check if we need to refresh or if we have a refresh token
  const now = Math.floor(Date.now() / 1000);

  if (tokenData && tokenData.expires_at > now + 60) {
    return tokenData.access_token;
  }

  if (tokenData && tokenData.refresh_token) {
    try {
      const res = await fetch("https://www.strava.com/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: "refresh_token",
          refresh_token: tokenData.refresh_token,
        }),
      });

      if (!res.ok) {
        throw new Error(`Refresh token failed: ${res.statusText}`);
      }

      const refreshed = await res.json();
      const updated: StravaTokenData = {
        access_token: refreshed.access_token,
        refresh_token: refreshed.refresh_token || tokenData.refresh_token,
        expires_at: refreshed.expires_at,
      };

      await saveToken(updated);
      return updated.access_token;
    } catch (err) {
      console.error("Error refreshing token:", err);
    }
  }

  return null;
}
