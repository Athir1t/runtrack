import { NextResponse } from "next/server";
import {
  getAthleteSessionCookieName,
  getAdminSessionCookieOptions,
  getRequestAthleteSession,
} from "@/utils/admin-auth";
import {
  disconnectAthleteFromStrava,
  getAthleteStravaToken,
} from "@/utils/database";

export async function POST(request: Request) {
  const athleteSession = await getRequestAthleteSession(request);
  if (!athleteSession) {
    return NextResponse.json({ error: "Athlete login required." }, { status: 401 });
  }

  try {
    const token = await getAthleteStravaToken(athleteSession.athleteId);
    let revocationWarning: string | undefined;

    if (token) {
      try {
        const response = await fetch("https://www.strava.com/oauth/deauthorize", {
          method: "POST",
          headers: { Authorization: `Bearer ${token.access_token}` },
          signal: AbortSignal.timeout(8000),
        });
        if (!response.ok) {
          revocationWarning =
            "Strava could not confirm revocation. You can also revoke access in your Strava settings.";
        }
      } catch {
        revocationWarning =
          "Strava could not confirm revocation. You can also revoke access in your Strava settings.";
      }
    }

    await disconnectAthleteFromStrava(athleteSession.athleteId);

    const response = NextResponse.json({
      success: true,
      message: "Disconnected successfully",
      ...(revocationWarning ? { warning: revocationWarning } : {}),
    });
    response.cookies.set(getAthleteSessionCookieName(), "", {
      ...getAdminSessionCookieOptions(),
      maxAge: 0,
    });
    return response;
  } catch (error) {
    console.error("Failed to disconnect athlete from Strava:", error);
    return NextResponse.json(
      { error: "Unable to disconnect Strava. Please try again." },
      { status: 500 }
    );
  }
}
