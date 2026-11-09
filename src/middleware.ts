import { NextRequest, NextResponse } from "next/server";
import {
  getAthleteSessionCookieName,
  getAdminSessionCookieName,
  verifyAthleteSession,
  verifyAdminSession,
} from "@/utils/admin-auth";

function requiresAdmin(request: NextRequest): boolean {
  const { pathname, searchParams } = request.nextUrl;
  if (pathname === "/api/athletes/me/activities") return false;
  if (pathname === "/api/strava/sync") {
    return true;
  }
  return (
    pathname.startsWith("/api/") &&
    !pathname.startsWith("/api/admin/") &&
    !pathname.endsWith("/callback") &&
    !["GET", "HEAD", "OPTIONS"].includes(request.method)
  );
}

export async function middleware(request: NextRequest) {
  const isActivityRefresh =
    request.nextUrl.pathname === "/api/strava/activities" &&
    request.nextUrl.searchParams.get("refresh") === "1";
  if (!requiresAdmin(request) && !isActivityRefresh) {
    return NextResponse.next();
  }

  const origin = request.headers.get("origin");
  if (
    origin &&
    !["GET", "HEAD", "OPTIONS"].includes(request.method) &&
    new URL(origin).origin !== request.nextUrl.origin
  ) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const isAdmin = await verifyAdminSession(
    request.cookies.get(getAdminSessionCookieName())?.value
  );
  const isAthlete = isActivityRefresh
    ? Boolean(
        await verifyAthleteSession(
          request.cookies.get(getAthleteSessionCookieName())?.value
        )
      )
    : false;
  if (isAdmin || isAthlete) return NextResponse.next();

  if (request.nextUrl.pathname === "/api/strava/auth") {
    return NextResponse.redirect(new URL("/?admin=login", request.url));
  }
  return NextResponse.json({ error: "Admin login required." }, { status: 401 });
}

export const config = {
  matcher: ["/api/:path*"],
};
