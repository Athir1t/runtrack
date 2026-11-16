import { NextRequest, NextResponse } from "next/server";
import {
  getAdminSessionCookieName,
  verifyAdminSession,
} from "@/utils/admin-auth";

function requiresAdmin(request: NextRequest): boolean {
  const { pathname } = request.nextUrl;
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

function isAthleteDisconnect(request: NextRequest): boolean {
  return (
    request.nextUrl.pathname === "/api/strava/disconnect" &&
    request.method === "POST"
  );
}

export async function middleware(request: NextRequest) {
  const athleteDisconnect = isAthleteDisconnect(request);
  if (!requiresAdmin(request) && !athleteDisconnect) {
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

  if (athleteDisconnect) return NextResponse.next();

  const isAdmin = await verifyAdminSession(
    request.cookies.get(getAdminSessionCookieName())?.value
  );
  if (isAdmin) return NextResponse.next();

  if (request.nextUrl.pathname === "/api/strava/auth") {
    return NextResponse.redirect(new URL("/?admin=login", request.url));
  }
  return NextResponse.json({ error: "Admin login required." }, { status: 401 });
}

export const config = {
  matcher: ["/api/:path*"],
};
