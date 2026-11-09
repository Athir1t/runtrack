import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import {
  createAdminSession,
  getAdminSessionCookieName,
  getAdminSessionCookieOptions,
  isAdminConfigured,
} from "@/utils/admin-auth";

function equalSecret(actual: string, expected: string): boolean {
  const actualBytes = Buffer.from(actual);
  const expectedBytes = Buffer.from(expected);
  return (
    actualBytes.length === expectedBytes.length &&
    timingSafeEqual(actualBytes, expectedBytes)
  );
}

export async function POST(request: Request) {
  if (!isAdminConfigured()) {
    return NextResponse.json(
      { error: "Admin login is not configured on this deployment." },
      { status: 503 }
    );
  }

  const origin = request.headers.get("origin");
  if (origin && new URL(origin).origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  let credentials: unknown;
  try {
    credentials = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid login request." }, { status: 400 });
  }

  const username =
    typeof credentials === "object" &&
    credentials !== null &&
    "username" in credentials &&
    typeof credentials.username === "string"
      ? credentials.username
      : "";
  const password =
    typeof credentials === "object" &&
    credentials !== null &&
    "password" in credentials &&
    typeof credentials.password === "string"
      ? credentials.password
      : "";

  const configuredUsername = process.env.ADMIN_USERNAME || "";
  const configuredPassword = process.env.ADMIN_PASSWORD || "";
  if (
    !equalSecret(username, configuredUsername) ||
    !equalSecret(password, configuredPassword)
  ) {
    return NextResponse.json({ error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" }, { status: 401 });
  }

  const response = NextResponse.json({ authenticated: true });
  response.cookies.set(
    getAdminSessionCookieName(),
    await createAdminSession(),
    getAdminSessionCookieOptions()
  );
  return response;
}
