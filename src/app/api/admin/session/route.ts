import { NextRequest, NextResponse } from "next/server";
import {
  getAdminSessionCookieName,
  isAdminConfigured,
  verifyAdminSession,
} from "@/utils/admin-auth";

export async function GET(request: NextRequest) {
  const authenticated = await verifyAdminSession(
    request.cookies.get(getAdminSessionCookieName())?.value
  );
  return NextResponse.json({
    configured: isAdminConfigured(),
    authenticated,
  });
}
