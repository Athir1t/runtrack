import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { getAthleteStravaConnections } from "@/utils/database";
import { getCurrentThailandWeekStart } from "@/utils/program-week";
import { syncAthleteWeek } from "@/utils/strava-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("CRON_SECRET is not configured.");
    return NextResponse.json({ error: "Cron authentication is not configured." }, { status: 503 });
  }

  const authorization = request.headers.get("authorization") || "";
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(authorization);
  if (
    expected.length !== received.length ||
    !timingSafeEqual(expected, received)
  ) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const weekStart = getCurrentThailandWeekStart();
    const connections = await getAthleteStravaConnections();
    let nextConnection = 0;
    let synced = 0;
    const failures: string[] = [];

    const workers = Array.from(
      { length: Math.min(2, connections.length) },
      async () => {
        while (nextConnection < connections.length) {
          const connection = connections[nextConnection++];
          try {
            await syncAthleteWeek(connection.athleteId, weekStart);
            synced += 1;
          } catch (error) {
            console.error(
              `Daily Strava sync failed for athlete ${connection.athleteId}:`,
              error
            );
            failures.push(connection.athleteId);
          }
        }
      }
    );
    await Promise.all(workers);

    return NextResponse.json({
      weekStart,
      connectedAthletes: connections.length,
      synced,
      failed: failures.length,
      failedAthleteIds: failures,
    });
  } catch (error) {
    console.error("Daily Strava sync job failed:", error);
    return NextResponse.json({ error: "Daily Strava sync failed." }, { status: 503 });
  }
}
