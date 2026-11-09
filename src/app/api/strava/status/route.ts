import { NextResponse } from "next/server";
import { getStravaConnection } from "@/utils/database";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const connection = await getStravaConnection();
    return NextResponse.json({
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
