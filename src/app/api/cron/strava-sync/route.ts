import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { getAthleteStravaConnections } from "@/utils/database";
import { syncAthleteWeek } from "@/utils/strava-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function getCurrentWeekStart(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = (type: string) => parts.find((part) => part.type === type)?.value;
  const localDate = `${value("year")}-${value("month")}-${value("day")}`;
  const weekStart = new Date(`${localDate}T00:00:00Z`);
  weekStart.setUTCDate(weekStart.getUTCDate() - ((weekStart.getUTCDay() + 6) % 7));
  return weekStart.toISOString().slice(0, 10);
}

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
    const weekStart = getCurrentWeekStart();
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
