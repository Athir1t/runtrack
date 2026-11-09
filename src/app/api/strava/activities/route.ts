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
  getWeeklyAthleteActivitySummaries,
  getWeeklyProgram,
  getWeeklyActivities,
  getWeeklyActivitySync,
  saveWeeklyActivities,
  StoredStravaActivity,
  StravaLap,
} from "@/utils/database";
import { getValidAccessToken } from "@/utils/strava";
import { getWorkoutType } from "@/utils/workout";

export const dynamic = "force-dynamic";

interface StravaProfile {
  id: number;
  firstname?: string;
  lastname?: string;
}

interface StravaActivity {
  id: number;
  name?: string;
  distance?: number;
  moving_time?: number;
  start_date?: string;
  start_date_local?: string;
  average_heartrate?: number;
  type?: string;
  sport_type?: string;
}

interface StravaActivityLap {
  id?: number;
  lap_index?: number;
  name?: string;
  distance?: number;
  moving_time?: number;
  elapsed_time?: number;
  start_date?: string;
  average_speed?: number;
  average_heartrate?: number;
  max_heartrate?: number;
}

function isValidDate(value: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime()) &&
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
  );
}

function isIntervalProgram(title: string, detail?: string): boolean {
  return getWorkoutType({ title, detail }) === "interval";
}

function getProgramDay(activity: StravaActivity, weekStart: string): number | null {
  const date = (activity.start_date_local || activity.start_date || "").slice(0, 10);
  if (!isValidDate(date)) return null;
  const activityDay = new Date(`${date}T00:00:00Z`).getTime();
  const startDay = new Date(`${weekStart}T00:00:00Z`).getTime();
  const dayIndex = Math.floor((activityDay - startDay) / (24 * 60 * 60 * 1000));
  return dayIndex >= 0 && dayIndex < 7 ? dayIndex : null;
}

function toLap(lap: StravaActivityLap, index: number): StravaLap {
  return {
    id: lap.id,
    lapIndex: lap.lap_index || index + 1,
    name: lap.name,
    distanceKm: Number(((lap.distance || 0) / 1000).toFixed(3)),
    movingTimeSeconds: lap.moving_time || 0,
    elapsedTimeSeconds: lap.elapsed_time || 0,
    startDate: lap.start_date || "",
    averageSpeedMps: lap.average_speed,
    averageHeartrate: lap.average_heartrate,
    maxHeartrate: lap.max_heartrate,
  };
}

function matchesProfile(profile: StravaProfile, connection: {
  stravaAthleteId: string;
}): boolean {
  return String(profile.id) === connection.stravaAthleteId;
}

async function syncAthleteWeek(
  athleteId: string,
  weekStart: string
): Promise<{ athleteName: string; syncedAt?: string }> {
  const connection = await getAthleteStravaConnection(athleteId);
  if (!connection) {
    throw new Error("Connect this athlete's Strava account before syncing.");
  }
  const token = await getValidAccessToken(athleteId);
  if (!token) throw new Error("Strava authorization expired. Sign in with Strava again.");

  const profileResponse = await fetch("https://www.strava.com/api/v3/athlete", {
    headers: { Authorization: "Bearer " + token },
    cache: "no-store",
  });
  if (!profileResponse.ok) {
    const details = await profileResponse.text();
    console.error(`Strava profile request failed (${profileResponse.status}): ${details}`);
    throw new Error("Unable to verify this Strava account.");
  }
  const profile: StravaProfile = await profileResponse.json();
  if (!matchesProfile(profile, connection)) {
    throw new Error("The saved Strava connection does not match this athlete.");
  }

  const program = await getWeeklyProgram(weekStart);
  if (!program) throw new Error("No training program exists for this week.");
  const weekStartTime = new Date(`${weekStart}T00:00:00+07:00`).getTime();
  const weekEndTime = weekStartTime + 7 * 24 * 60 * 60 * 1000;
  const response = await fetch(
    `https://www.strava.com/api/v3/athlete/activities?per_page=200&after=${Math.floor(
      weekStartTime / 1000
    ) - 1}&before=${Math.floor(weekEndTime / 1000)}`,
    {
      headers: { Authorization: "Bearer " + token },
      cache: "no-store",
    }
  );
  if (!response.ok) {
    const details = await response.text();
    console.error(`Strava activities request failed (${response.status}): ${details}`);
    throw new Error("Unable to load this week's Strava activities.");
  }

  const rawActivities: unknown = await response.json();
  if (!Array.isArray(rawActivities)) {
    throw new Error("Strava returned an invalid activities response.");
  }
  const cached = await getWeeklyActivities(athleteId, weekStart);
  const cachedById = new Map(cached.map((activity) => [activity.id, activity]));
  const activities = (rawActivities as StravaActivity[])
    .filter((activity) => activity.type === "Run" || activity.sport_type === "Run")
    .map((activity) => {
      const dayIndex = getProgramDay(activity, weekStart);
      const schedule = dayIndex === null ? undefined : program.schedule[dayIndex];
      const isIntervalDay = Boolean(
        schedule && isIntervalProgram(schedule.title, schedule.detail)
      );
      return {
        id: activity.id,
        athleteId,
        athleteName: connection.athleteName,
        name: activity.name || "วิ่ง",
        distanceKm: Number(((activity.distance || 0) / 1000).toFixed(3)),
        movingTimeSeconds: activity.moving_time || 0,
        startDate: activity.start_date || "",
        startDateLocal: activity.start_date_local || "",
        averageHeartrate: activity.average_heartrate,
        isIntervalDay,
        laps: isIntervalDay ? cachedById.get(activity.id)?.laps || [] : [],
      } satisfies StoredStravaActivity;
    });

  const needsLaps = activities.filter(
    (activity) => activity.isIntervalDay && activity.laps.length === 0
  );
  let nextLap = 0;
  const workers = Array.from({ length: Math.min(3, needsLaps.length) }, async () => {
    while (nextLap < needsLaps.length) {
      const activity = needsLaps[nextLap++];
      const lapResponse = await fetch(
        `https://www.strava.com/api/v3/activities/${activity.id}/laps`,
        {
          headers: { Authorization: "Bearer " + token },
          cache: "no-store",
        }
      );
      if (!lapResponse.ok) {
        const details = await lapResponse.text();
        console.error(`Strava lap request failed (${lapResponse.status}): ${details}`);
        throw new Error("Unable to load interval laps from Strava.");
      }
      const rawLaps: unknown = await lapResponse.json();
      if (!Array.isArray(rawLaps)) {
        throw new Error(`Strava returned invalid lap data for activity ${activity.id}.`);
      }
      activity.laps = (rawLaps as StravaActivityLap[]).map(toLap);
    }
  });
  await Promise.all(workers);
  await saveWeeklyActivities(athleteId, weekStart, activities);
  const sync = await getWeeklyActivitySync(athleteId, weekStart);
  return { athleteName: connection.athleteName, syncedAt: sync?.syncedAt };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const weekStart = searchParams.get("weekStart");
  if (!weekStart || !isValidDate(weekStart)) {
    return NextResponse.json({ message: "Invalid week start date." }, { status: 400 });
  }

  try {
    const cookieStore = await cookies();
    const athleteSession = await verifyAthleteSession(
      cookieStore.get(getAthleteSessionCookieName())?.value
    );
    const isAdmin = await verifyAdminSession(
      cookieStore.get(getAdminSessionCookieName())?.value
    );
    const isAuthenticated = Boolean(athleteSession || isAdmin);
    const forceRefresh = searchParams.get("refresh") === "1";
    if (forceRefresh && !isAuthenticated) {
      return NextResponse.json({ message: "Sign in before syncing activities." }, { status: 401 });
    }

    const targetAthleteId =
      athleteSession?.athleteId ||
      (isAdmin ? searchParams.get("athleteId") : null);
    let syncedAt: string | undefined;
    let connected = false;
    let athleteName: string | undefined;
    if (targetAthleteId) {
      const connection = await getAthleteStravaConnection(targetAthleteId);
      connected = Boolean(connection);
      athleteName = connection?.athleteName;
      if (forceRefresh) {
        const result = await syncAthleteWeek(targetAthleteId, weekStart);
        connected = true;
        athleteName = result.athleteName;
        syncedAt = result.syncedAt;
      } else {
        const sync = await getWeeklyActivitySync(targetAthleteId, weekStart);
        syncedAt = sync?.syncedAt;
      }
    }

    const summaries = await getWeeklyAthleteActivitySummaries(weekStart);
    const roster = await getAthletes();
    const athleteNames = new Map(roster.map((athlete) => [athlete.id, athlete.nickname]));
    const athleteSummaries = summaries.map((summary) => ({
      ...summary,
      athleteName: athleteNames.get(summary.athleteId) || summary.athleteId,
    }));
    const requestedAthleteId = searchParams.get("athleteId");
    const activities = isAuthenticated
      ? (await getAllWeeklyActivities(weekStart))
          .filter(
            (activity) =>
              !requestedAthleteId || activity.athleteId === requestedAthleteId
          )
          .map((activity) => ({
          ...activity,
          athleteName: athleteNames.get(activity.athleteId) || activity.athleteId,
          }))
      : [];

    return NextResponse.json({
      authenticated: isAuthenticated,
      connected,
      athleteName,
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
    return NextResponse.json({ message }, { status });
  }
}
