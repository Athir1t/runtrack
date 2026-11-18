import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  getAdminSessionCookieName,
  getAthleteSessionCookieName,
  verifyAdminSession,
  verifyAthleteSession,
} from "@/utils/admin-auth";
import {
  getAllWeeklyActivities,
  getAthleteStravaConnection,
  getAthletes,
  getWeeklyActivities,
  getWeeklyAthleteActivitySummaries,
  getWeeklyProgram,
  getWeeklyActivitySync,
} from "@/utils/database";
import type { StoredStravaActivity } from "@/utils/database";
import { getDefaultWeek } from "@/utils/program-week";
import { syncAthleteWeek } from "@/utils/strava-sync";
import { getWorkoutType } from "@/utils/workout";

export const dynamic = "force-dynamic";

function privateJson(body: Record<string, unknown>, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Vary", "Cookie");
  return response;
}

function isValidDate(value: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime()) &&
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
  );
}

function getActivityLocalDate(activity: {
  startDate?: string | null;
  startDateLocal?: string | null;
}): string {
  if (activity.startDateLocal) return activity.startDateLocal.slice(0, 10);
  if (!activity.startDate) return "";
  const date = new Date(activity.startDate);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const weekStart = searchParams.get("weekStart");
  const requestedDayIndex = searchParams.get("dayIndex");
  const dayIndex =
    requestedDayIndex !== null && /^[0-6]$/.test(requestedDayIndex)
      ? Number(requestedDayIndex)
      : null;
  if (!weekStart || !isValidDate(weekStart)) {
    return privateJson({ message: "Invalid week start date." }, { status: 400 });
  }
  if (requestedDayIndex !== null && dayIndex === null) {
    return privateJson({ message: "Invalid program day." }, { status: 400 });
  }

  try {
    const cookieStore = await cookies();
    const [athleteSession, isAdmin] = await Promise.all([
      verifyAthleteSession(
        cookieStore.get(getAthleteSessionCookieName())?.value
      ),
      verifyAdminSession(cookieStore.get(getAdminSessionCookieName())?.value),
    ]);
    const isAuthenticated = Boolean(athleteSession || isAdmin);
    const forceRefresh = searchParams.get("refresh") === "1";

    if (!isAuthenticated) {
      const [program, roster] = await Promise.all([
        getWeeklyProgram(weekStart).then(
          (savedProgram) => savedProgram || getDefaultWeek(weekStart)
        ),
        getAthletes(),
      ]);

      return privateJson({
        authenticated: false,
        program,
        athletes: roster
          .filter((athlete) => athlete.inClub)
          .map((athlete) => ({
            id: athlete.id,
            nickname: athlete.nickname,
            stravaName: "",
            gender: athlete.gender,
            distanceKm: 0,
            runsCount: 0,
            inClub: true,
          })),
      });
    }

    const targetAthleteId =
      athleteSession?.athleteId ||
      (isAdmin ? searchParams.get("athleteId") : null);
    let syncedAt: string | undefined;
    let connected = false;
    let athleteName: string | undefined;
    if (targetAthleteId) {
      const connectionPromise = getAthleteStravaConnection(targetAthleteId);
      const syncPromise = forceRefresh
        ? null
        : getWeeklyActivitySync(targetAthleteId, weekStart);
      const [connection, sync] = await Promise.all([
        connectionPromise,
        syncPromise,
      ]);
      connected = Boolean(connection);
      athleteName = connection?.athleteName;
      if (forceRefresh) {
        const result = await syncAthleteWeek(targetAthleteId, weekStart);
        connected = true;
        athleteName = result.athleteName;
        syncedAt = result.syncedAt;
      } else {
        syncedAt = sync?.syncedAt;
      }
    }

    const [program, summaries, roster] = await Promise.all([
      getWeeklyProgram(weekStart).then(
        (savedProgram) => savedProgram || getDefaultWeek(weekStart)
      ),
      getWeeklyAthleteActivitySummaries(weekStart),
      getAthletes(),
    ]);
    const athleteNames = new Map(roster.map((athlete) => [athlete.id, athlete.nickname]));
    const athleteNameForSession = athleteSession
      ? athleteNames.get(athleteSession.athleteId)
      : undefined;
    const athleteSummaries = summaries.map((summary) => ({
      ...summary,
      athleteName: athleteNames.get(summary.athleteId) || summary.athleteId,
    }));
    const requestedAthleteId = searchParams.get("athleteId");
    let activities: StoredStravaActivity[] = [];
    if (isAuthenticated && dayIndex !== null) {
      const selectedDay = program.schedule[dayIndex];
      if (!selectedDay) {
        return privateJson({ message: "Program day not found." }, { status: 404 });
      }
      const targetDate = new Date(`${weekStart}T00:00:00Z`);
      targetDate.setUTCDate(targetDate.getUTCDate() + dayIndex);
      const targetLocalDate = targetDate.toISOString().slice(0, 10);
      const omitLaps = getWorkoutType(selectedDay) === "interval";
      const clubAthleteIds = new Set(
        roster
          .filter((athlete) => athlete.inClub)
          .map((athlete) => athlete.id)
      );
      activities = (await getAllWeeklyActivities(weekStart))
        .filter(
          (activity) =>
            clubAthleteIds.has(activity.athleteId) &&
            getActivityLocalDate(activity) === targetLocalDate
        )
        .map((activity) => ({
          ...activity,
          athleteName: athleteNames.get(activity.athleteId) || activity.athleteId,
          ...(omitLaps ? { laps: [] } : {}),
        }));
    } else if (isAuthenticated && requestedAthleteId) {
      activities = (await getWeeklyActivities(requestedAthleteId, weekStart)).map(
        (activity) => ({
          ...activity,
          athleteName:
            athleteNames.get(activity.athleteId) || activity.athleteId,
        })
      );
    } else if (isAuthenticated && forceRefresh) {
      activities = (await getAllWeeklyActivities(weekStart)).map((activity) => ({
        ...activity,
        athleteName: athleteNames.get(activity.athleteId) || activity.athleteId,
      }));
    }

    return privateJson({
      authenticated: isAuthenticated,
      isAdmin,
      athleteId: athleteSession?.athleteId,
      sessionAthleteName: athleteNameForSession,
      connected,
      athleteName,
      program,
      athletes: roster,
      activities,
      athleteSummaries,
      source: "postgres",
      cached: !forceRefresh,
      syncedAt,
    });
  } catch (error) {
    console.error("Error loading weekly athlete activities:", error);
    const message = error instanceof Error ? error.message : "Unable to load activities.";
    const status = /sign in|connect .*strava|authorization expired/i.test(message)
      ? 401
      : 503;
    return privateJson({ message }, { status });
  }
}
