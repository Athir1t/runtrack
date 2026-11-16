import { NextResponse } from "next/server";
import { isAdminRequest } from "@/utils/admin-auth";
import { getAthleteStravaConnections } from "@/utils/database";
import { syncAthleteWeek } from "@/utils/strava-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isValidDate(value: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime()) &&
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
  );
}

export async function POST(request: Request) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: "Admin login required." }, { status: 401 });
  }

  const body: unknown = await request.json().catch(() => null);
  if (
    typeof body !== "object" ||
    body === null ||
    !("weekStart" in body) ||
    typeof body.weekStart !== "string" ||
    !isValidDate(body.weekStart)
  ) {
    return NextResponse.json({ error: "Invalid weekStart date." }, { status: 400 });
  }
  const weekStart = body.weekStart;

  try {
    const connections = await getAthleteStravaConnections();
    const results: Array<{
      athleteId: string;
      athleteName: string;
      success: boolean;
      error?: string;
    }> = new Array(connections.length);
    let nextConnection = 0;

    const workers = Array.from(
      { length: Math.min(2, connections.length) },
      async () => {
        while (nextConnection < connections.length) {
          const index = nextConnection++;
          const connection = connections[index];
          try {
            await syncAthleteWeek(connection.athleteId, weekStart);
            results[index] = {
              athleteId: connection.athleteId,
              athleteName: connection.athleteName,
              success: true,
            };
          } catch (error) {
            console.error(
              `Admin Strava sync failed for athlete ${connection.athleteId}:`,
              error
            );
            results[index] = {
              athleteId: connection.athleteId,
              athleteName: connection.athleteName,
              success: false,
              error: error instanceof Error ? error.message : "Sync failed.",
            };
          }
        }
      }
    );
    await Promise.all(workers);

    const synced = results.filter((result) => result.success).length;
    return NextResponse.json({
      weekStart,
      connectedAthletes: connections.length,
      synced,
      failed: connections.length - synced,
      results,
    });
  } catch (error) {
    console.error("Admin bulk Strava sync failed:", error);
    return NextResponse.json(
      { error: "Unable to sync connected Strava accounts." },
      { status: 503 }
    );
  }
}
