import {
  getAthleteStravaConnection,
  getWeeklyActivities,
  getWeeklyActivitySync,
  getWeeklyProgram,
  saveWeeklyActivities,
  StoredStravaActivity,
  StravaLap,
} from "@/utils/database";
import { getValidAccessToken } from "@/utils/strava";
import { getWorkoutType } from "@/utils/workout";
import { getDefaultWeek } from "@/utils/program-week";

interface StravaProfile {
  id: number;
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

export async function syncAthleteWeek(
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
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!profileResponse.ok) {
    const details = await profileResponse.text();
    console.error(`Strava profile request failed (${profileResponse.status}): ${details}`);
    throw new Error("Unable to verify this Strava account.");
  }
  const profile: StravaProfile = await profileResponse.json();
  if (String(profile.id) !== connection.stravaAthleteId) {
    throw new Error("The saved Strava connection does not match this athlete.");
  }

  const program =
    (await getWeeklyProgram(weekStart)) || getDefaultWeek(weekStart);
  const weekStartTime = new Date(`${weekStart}T00:00:00+07:00`).getTime();
  const weekEndTime = weekStartTime + 7 * 24 * 60 * 60 * 1000;
  const response = await fetch(
    `https://www.strava.com/api/v3/athlete/activities?per_page=200&after=${Math.floor(
      weekStartTime / 1000
    ) - 1}&before=${Math.floor(weekEndTime / 1000)}`,
    {
      headers: { Authorization: `Bearer ${token}` },
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
  const cachedById = new Map(
    cached
      .filter((activity) => activity.source !== "manual")
      .map((activity) => [activity.id, activity])
  );
  const activities = (rawActivities as StravaActivity[])
    .filter((activity) => activity.type === "Run" || activity.sport_type === "Run")
    .map((activity) => {
      const dayIndex = getProgramDay(activity, weekStart);
      const schedule = dayIndex === null ? undefined : program.schedule[dayIndex];
      const isIntervalDay = Boolean(
        schedule && getWorkoutType(schedule) === "interval"
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
          headers: { Authorization: `Bearer ${token}` },
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
