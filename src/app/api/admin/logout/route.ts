import { NextResponse } from "next/server";
import {
  getAdminSessionCookieName,
  getAdminSessionCookieOptions,
} from "@/utils/admin-auth";

export async function POST() {
  const response = NextResponse.json({ authenticated: false });
  response.cookies.set(getAdminSessionCookieName(), "", {
    ...getAdminSessionCookieOptions(),
    maxAge: 0,
  });
  return response;
}
