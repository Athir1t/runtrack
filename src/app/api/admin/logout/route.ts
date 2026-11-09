import { NextResponse } from "next/server";
import {
  getAthleteSessionCookieName,
  getAdminSessionCookieName,
  getAdminSessionCookieOptions,
} from "@/utils/admin-auth";

export async function POST() {
  const response = NextResponse.json({ authenticated: false });
  response.cookies.set(getAdminSessionCookieName(), "", {
    ...getAdminSessionCookieOptions(),
    maxAge: 0,
  });
  response.cookies.set(getAthleteSessionCookieName(), "", {
    ...getAdminSessionCookieOptions(),
    maxAge: 0,
  });
  return response;
}
