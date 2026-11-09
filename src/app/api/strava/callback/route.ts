import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { saveToken } from "@/utils/strava";
import { getAthletes, saveStravaConnection } from "@/utils/database";
import {
  createAthleteSession,
  getAdminSessionCookieOptions,
  getAthleteSessionCookieName,
} from "@/utils/admin-auth";

const OAUTH_STATE_COOKIE = "runtrack_strava_state";
const OAUTH_FLOW_COOKIE = "runtrack_strava_flow";

interface StravaProfile {
  id: number;
  firstname?: string;
  lastname?: string;
}

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
  const flow = req.headers
    .get("cookie")
    ?.split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${OAUTH_FLOW_COOKIE}=`))
    ?.slice(OAUTH_FLOW_COOKIE.length + 1);
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

    const profile: StravaProfile = await profileResponse.json();
    if (!Number.isSafeInteger(profile.id) || profile.id <= 0) {
      return redirectWithError("invalid_profile");
    }
    const athleteName = [profile.firstname, profile.lastname]
      .filter(Boolean)
      .join(" ")
      .trim();
    const normalizedName = normalizeName(athleteName);
    const athletes = await getAthletes();
    const matches = athletes.filter((item) => {
      if (!item.inClub || !item.stravaName.trim()) return false;
      const listedName = normalizeName(item.stravaName);
      return (
        listedName === normalizedName ||
        (/[.…]+$/.test(item.stravaName.trim()) &&
          listedName.length > 0 &&
          normalizedName.startsWith(listedName))
      );
    });

    if (matches.length === 0) {
      return redirectWithError("athlete_not_in_roster");
    }
    if (matches.length > 1) {
      return redirectWithError("athlete_match_ambiguous");
    }
    const athlete = matches[0];
    await saveStravaConnection(athlete.id, String(profile.id), athleteName);
    await saveToken(athlete.id, {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: tokenData.expires_at,
    });

    const response = NextResponse.redirect(
      `${origin}?${flow === "athlete" ? "athlete=connected" : "strava=connected"}`
    );
    response.cookies.set(
      getAthleteSessionCookieName(),
      await createAthleteSession(athlete.id, athleteName),
      { ...getAdminSessionCookieOptions(), sameSite: "lax" }
    );
    return clearStateCookie(response);
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
  response.cookies.set(OAUTH_FLOW_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/strava/callback",
    maxAge: 0,
  });
  return response;
}
