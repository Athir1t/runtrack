import { NextRequest, NextResponse } from "next/server";
import {
  getAdminSessionCookieName,
  verifyAdminSession,
} from "@/utils/admin-auth";

function requiresAdmin(request: NextRequest): boolean {
  const { pathname, searchParams } = request.nextUrl;
  if (pathname.startsWith("/api/strava/auth") || pathname === "/api/strava/sync") {
    return true;
  }
  if (
    pathname === "/api/strava/activities" &&
    searchParams.get("refresh") === "1"
  ) {
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
  if (!requiresAdmin(request)) return NextResponse.next();

  const origin = request.headers.get("origin");
  if (
    origin &&
    !["GET", "HEAD", "OPTIONS"].includes(request.method) &&
    new URL(origin).origin !== request.nextUrl.origin
  ) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const authenticated = await verifyAdminSession(
    request.cookies.get(getAdminSessionCookieName())?.value
  );
  if (authenticated) return NextResponse.next();

  if (request.nextUrl.pathname === "/api/strava/auth") {
    return NextResponse.redirect(new URL("/?admin=login", request.url));
  }
  return NextResponse.json({ error: "Admin login required." }, { status: 401 });
}

export const config = {
  matcher: ["/api/:path*"],
};
