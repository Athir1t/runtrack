import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  getAdminSessionCookieName,
  getAthleteSessionCookieName,
  verifyAdminSession,
  verifyAthleteSession,
} from "@/utils/admin-auth";
import { getAthleteStravaConnection } from "@/utils/database";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const athleteSession = await verifyAthleteSession(
      cookieStore.get(getAthleteSessionCookieName())?.value
    );
    const isAdmin = await verifyAdminSession(
      cookieStore.get(getAdminSessionCookieName())?.value
    );
    const athleteId =
      athleteSession?.athleteId || (isAdmin ? null : undefined);
    if (athleteId === undefined) {
      return NextResponse.json({
        authenticated: false,
        connected: false,
      });
    }
    const connection = athleteId
      ? await getAthleteStravaConnection(athleteId)
      : null;
    return NextResponse.json({
      authenticated: Boolean(athleteSession || isAdmin),
      connected: Boolean(connection),
      athleteName: connection?.athleteName,
    });
  } catch (error) {
    console.error("Error reading saved Strava connection:", error);
    return NextResponse.json(
      { connected: false, message: "ไม่สามารถตรวจสอบการเชื่อมต่อ Strava ได้" },
      { status: 503 }
    );
  }
}
