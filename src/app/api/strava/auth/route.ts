import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { isAdminRequest } from "@/utils/admin-auth";

const OAUTH_STATE_COOKIE = "runtrack_strava_state";

export async function GET(req: Request) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.redirect(new URL("/?admin=login", req.url));
  }

  const clientId = process.env.STRAVA_CLIENT_ID;
  const { origin } = new URL(req.url);
  if (!clientId) {
    return NextResponse.json(
      { error: "Strava OAuth is not configured." },
      { status: 503 }
    );
  }
  const redirectUri = `${origin}/api/strava/callback`;
  const scope = "read,activity:read_all,profile:read_all";
  const state = randomBytes(32).toString("base64url");
  const response = NextResponse.redirect(
    `https://www.strava.com/oauth/authorize?client_id=${encodeURIComponent(
      clientId
    )}&response_type=code&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&approval_prompt=auto&scope=${encodeURIComponent(
      scope
    )}&state=${encodeURIComponent(state)}`
  );
  response.cookies.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/strava/callback",
    maxAge: 600,
  });
  return response;
}
