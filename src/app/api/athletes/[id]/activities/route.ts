import { NextResponse } from "next/server";
import { getAthletes, getRecentAthleteActivities } from "@/utils/database";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const athletes = await getAthletes();
    const athlete = athletes.find((item) => item.id === id);
    if (!athlete) {
      return NextResponse.json({ message: "ไม่พบนักกีฬา" }, { status: 404 });
    }
    if (!athlete.inClub || !athlete.stravaName.trim()) {
      return NextResponse.json(
        { message: "นักกีฬาคนนี้ยังไม่มีบัญชี Strava ในคลับ" },
        { status: 404 }
      );
    }

    const activities = await getRecentAthleteActivities(athlete.id);
    return NextResponse.json({
      activities: activities.map((activity) => ({
        ...activity,
        athleteName: athlete.stravaName,
      })),
      source: "postgres",
    });
  } catch (error) {
    console.error("Error reading athlete activities from PostgreSQL:", error);
    return NextResponse.json(
      { message: "ไม่สามารถโหลดกิจกรรมที่บันทึกไว้ได้" },
      { status: 503 }
    );
  }
}
