import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { saveToken } from "@/utils/strava";
import { getAthletes, saveStravaConnection } from "@/utils/database";

const OAUTH_STATE_COOKIE = "runtrack_strava_state";

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[.…]+/g, "").trim();
}

export async function GET(req: Request) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const expectedState = req.headers
    .get("cookie")
    ?.split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${OAUTH_STATE_COOKIE}=`))
    ?.slice(OAUTH_STATE_COOKIE.length + 1);
  const redirectWithError = (reason: string) =>
    clearStateCookie(NextResponse.redirect(`${origin}?strava_error=${reason}`));

  if (
    !state ||
    !expectedState ||
    state.length !== expectedState.length ||
    !timingSafeEqual(Buffer.from(state), Buffer.from(expectedState))
  ) {
    return redirectWithError("invalid_state");
  }
  if (error || !code) {
    return redirectWithError(error || "no_code");
  }

  const clientId = process.env.STRAVA_CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;

  try {
    const res = await fetch("https://www.strava.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Token exchange failed:", errText);
      return redirectWithError("exchange_failed");
    }

    const tokenData = await res.json();
    const profileResponse = await fetch("https://www.strava.com/api/v3/athlete", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
      cache: "no-store",
    });
    if (!profileResponse.ok) {
      const details = await profileResponse.text();
      console.error(
        `Strava profile request failed after authorization (${profileResponse.status}): ${details}`
      );
      return redirectWithError("profile_lookup_failed");
    }

    const profile = await profileResponse.json();
    const athleteName = [profile.firstname, profile.lastname]
      .filter(Boolean)
      .join(" ")
      .trim();
    const normalizedName = normalizeName(athleteName);
    const athletes = await getAthletes();
    const athlete = athletes.find((item) => {
      const listedName = normalizeName(item.stravaName);
      return (
        listedName === normalizedName ||
        (/[.…]+$/.test(item.stravaName.trim()) &&
          normalizedName.startsWith(listedName))
      );
    });

    if (!athlete) {
      return redirectWithError("athlete_not_in_roster");
    }
    await saveToken({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: tokenData.expires_at,
    });
    await saveStravaConnection(athlete.id, athleteName);

    return clearStateCookie(NextResponse.redirect(`${origin}?strava=connected`));
  } catch (err) {
    console.error("Strava callback error:", err);
    return redirectWithError("unknown");
  }
}

function clearStateCookie(response: NextResponse): NextResponse {
  response.cookies.set(OAUTH_STATE_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/strava/callback",
    maxAge: 0,
  });
  return response;
}
