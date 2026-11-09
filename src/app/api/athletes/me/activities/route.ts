import { NextResponse } from "next/server";
import { addManualActivity, getAthletes } from "@/utils/database";
import { getRequestAthleteSession } from "@/utils/admin-auth";

function isValidDate(value: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime()) &&
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
  );
}

function getMonday(value: string): string {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}

export async function POST(request: Request) {
  const session = await getRequestAthleteSession(request);
  if (!session) {
    return NextResponse.json({ error: "Athlete login required." }, { status: 401 });
  }

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid activity data." }, { status: 400 });
  }
  if (typeof input !== "object" || input === null) {
    return NextResponse.json({ error: "Invalid activity data." }, { status: 400 });
  }

  const data = input as Record<string, unknown>;
  const { weekStart, name, distanceKm, movingTimeSeconds, startDateLocal, averageHeartrate } = data;
  if (
    typeof weekStart !== "string" ||
    !isValidDate(weekStart) ||
    typeof name !== "string" ||
    !name.trim() ||
    name.trim().length > 120 ||
    typeof distanceKm !== "number" ||
    !Number.isFinite(distanceKm) ||
    distanceKm <= 0 ||
    distanceKm > 300 ||
    typeof movingTimeSeconds !== "number" ||
    !Number.isInteger(movingTimeSeconds) ||
    movingTimeSeconds <= 0 ||
    movingTimeSeconds > 86400 ||
    typeof startDateLocal !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(startDateLocal) ||
    !isValidDate(startDateLocal.slice(0, 10)) ||
    typeof averageHeartrate !== "undefined" &&
      (typeof averageHeartrate !== "number" ||
        !Number.isFinite(averageHeartrate) ||
        averageHeartrate < 30 ||
        averageHeartrate > 250)
  ) {
    return NextResponse.json({ error: "Activity details are invalid." }, { status: 400 });
  }

  const [hours, minutes] = startDateLocal.slice(11).split(":").map(Number);
  const date = new Date(`${startDateLocal}:00+07:00`);
  if (
    Number.isNaN(date.getTime()) ||
    hours > 23 ||
    minutes > 59 ||
    getMonday(startDateLocal.slice(0, 10)) !== weekStart
  ) {
    return NextResponse.json(
      { error: "Activity date must be within the selected training week." },
      { status: 400 }
    );
  }

  try {
    const athlete = (await getAthletes()).find(
      (item) => item.id === session.athleteId && item.inClub
    );
    if (!athlete) {
      return NextResponse.json({ error: "Athlete is not on the active roster." }, { status: 403 });
    }

    await addManualActivity({
      athleteId: athlete.id,
      weekStart,
      name: name.trim(),
      distanceKm,
      movingTimeSeconds,
      startDateLocal,
      averageHeartrate: averageHeartrate as number | undefined,
    });
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error("Error saving manual athlete activity:", error);
    return NextResponse.json(
      { error: "Could not save this activity." },
      { status: 503 }
    );
  }
}
