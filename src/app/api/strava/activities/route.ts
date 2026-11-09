import { NextResponse } from "next/server";
import {
  getAthletes,
  getStravaConnection,
  getWeeklyActivities,
  getWeeklyActivitySync,
  getWeeklyProgram,
  saveStravaConnection,
  saveWeeklyActivities,
  StoredStravaActivity,
  StravaLap,
} from "@/utils/database";
import { getValidAccessToken } from "@/utils/strava";
import { getWorkoutType } from "@/utils/workout";
import {
  getAdminSessionCookieName,
  verifyAdminSession,
} from "@/utils/admin-auth";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

interface StravaAthlete {
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

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[.…]+/g, "").trim();
}

function isMatchingAthlete(stravaName: string, profileName: string): boolean {
  const listedName = normalizeName(stravaName);
  const connectedName = normalizeName(profileName);
  return (
    listedName === connectedName ||
    (/[.…]+$/.test(stravaName.trim()) && connectedName.startsWith(listedName))
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

async function getCachedResponse(
  athleteId: string,
  athleteName: string,
  weekStart: string,
  cachedSync: { activityCount: number; syncedAt: string }
) {
  const activities = (await getWeeklyActivities(athleteId, weekStart)).map(
    (activity) => ({ ...activity, athleteName })
  );
  return NextResponse.json({
    connected: true,
    athleteName,
    activities,
    source: "postgres",
    cached: true,
    syncedAt: cachedSync.syncedAt,
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const weekStart = searchParams.get("weekStart");
  if (!weekStart || !isValidDate(weekStart)) {
    return NextResponse.json({ message: "วันที่เริ่มสัปดาห์ไม่ถูกต้อง" }, { status: 400 });
  }

  try {
    const roster = await getAthletes();
    const savedConnection = await getStravaConnection();
    const forceRefresh = searchParams.get("refresh") === "1";
    const savedSync = savedConnection
      ? await getWeeklyActivitySync(savedConnection.athleteId, weekStart)
      : null;

    if (!forceRefresh && savedConnection && savedSync) {
      return await getCachedResponse(
        savedConnection.athleteId,
        savedConnection.athleteName,
        weekStart,
        savedSync
      );
    }

    const cookieStore = await cookies();
    const isAdmin = await verifyAdminSession(
      cookieStore.get(getAdminSessionCookieName())?.value
    );
    if (forceRefresh && !isAdmin) {
      return NextResponse.json({ message: "Admin login required." }, { status: 401 });
    }
    if (!forceRefresh && !isAdmin) {
      if (savedConnection) {
        return NextResponse.json({
          connected: true,
          athleteName: savedConnection.athleteName,
          activities: (await getWeeklyActivities(
            savedConnection.athleteId,
            weekStart
          )).map((activity) => ({
            ...activity,
            athleteName: savedConnection.athleteName,
          })),
          source: "postgres",
          cached: true,
          needsSync: true,
        });
      }
      return NextResponse.json({ connected: false, activities: [] });
    }

    const token = await getValidAccessToken();
    if (!token) {
      if (savedConnection && savedSync) {
        return await getCachedResponse(
          savedConnection.athleteId,
          savedConnection.athleteName,
          weekStart,
          savedSync
        );
      }
      return NextResponse.json({ connected: false, activities: [] });
    }

    const profileResponse = await fetch("https://www.strava.com/api/v3/athlete", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!profileResponse.ok) {
      const details = await profileResponse.text();
      console.error(`Strava profile request failed (${profileResponse.status}): ${details}`);
      return NextResponse.json(
        { connected: false, message: "ไม่สามารถตรวจสอบบัญชี Strava ได้" },
        { status: 502 }
      );
    }

    const profile: StravaAthlete = await profileResponse.json();
    const athleteName = [profile.firstname, profile.lastname].filter(Boolean).join(" ").trim();
    const athlete = roster.find((item) => isMatchingAthlete(item.stravaName, athleteName));
    if (!athlete) {
      return NextResponse.json(
        {
          connected: false,
          athleteName,
          message: `ไม่พบ ${athleteName} ในรายชื่อนักกีฬาที่บันทึกไว้`,
        },
        { status: 404 }
      );
    }

    await saveStravaConnection(athlete.id, athleteName);

    const program = await getWeeklyProgram(weekStart);
    if (!program) {
      return NextResponse.json(
        { connected: false, message: "ไม่พบโปรแกรมสำหรับสัปดาห์นี้" },
        { status: 404 }
      );
    }

    const cachedActivities = await getWeeklyActivities(athlete.id, weekStart);
    const cachedById = new Map(cachedActivities.map((activity) => [activity.id, activity]));
    const weekStartTime = new Date(`${weekStart}T00:00:00+07:00`).getTime();
    const weekEndTime = weekStartTime + 7 * 24 * 60 * 60 * 1000;

    const activitiesResponse = await fetch(
      `https://www.strava.com/api/v3/athlete/activities?per_page=200&after=${Math.floor(
        weekStartTime / 1000
      ) - 1}&before=${Math.floor(weekEndTime / 1000)}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      }
    );
    if (!activitiesResponse.ok) {
      const details = await activitiesResponse.text();
      console.error(
        `Strava weekly activities request failed (${activitiesResponse.status}): ${details}`
      );
      return NextResponse.json(
        { connected: false, message: "ไม่สามารถโหลดกิจกรรม Strava สำหรับสัปดาห์นี้ได้" },
        { status: 502 }
      );
    }

    const rawActivities: unknown = await activitiesResponse.json();
    if (!Array.isArray(rawActivities)) {
      throw new Error("Strava returned an invalid activities response");
    }

    const activities = (rawActivities as StravaActivity[])
      .filter((activity) => activity.type === "Run" || activity.sport_type === "Run")
      .map((activity) => {
        const dayIndex = getProgramDay(activity, weekStart);
        const dayProgram = dayIndex === null ? undefined : program.schedule[dayIndex];
        const isIntervalDay = Boolean(
          dayProgram && isIntervalProgram(dayProgram.title, dayProgram.detail)
        );
        const cached = cachedById.get(activity.id);
        return {
          id: activity.id,
          athleteId: athlete.id,
          athleteName,
          name: activity.name || "วิ่ง",
          distanceKm: Number(((activity.distance || 0) / 1000).toFixed(3)),
          movingTimeSeconds: activity.moving_time || 0,
          startDate: activity.start_date || "",
          startDateLocal: activity.start_date_local || "",
          averageHeartrate: activity.average_heartrate,
          isIntervalDay,
          laps: isIntervalDay ? cached?.laps || [] : [],
        } satisfies StoredStravaActivity;
      });

    const intervalActivitiesNeedingLaps = activities.filter(
      (activity) => activity.isIntervalDay && activity.laps.length === 0
    );
    let nextLap = 0;
    const workers = Array.from(
      { length: Math.min(3, intervalActivitiesNeedingLaps.length) },
      async () => {
        while (nextLap < intervalActivitiesNeedingLaps.length) {
          const activity = intervalActivitiesNeedingLaps[nextLap++];
          const response = await fetch(
            `https://www.strava.com/api/v3/activities/${activity.id}/laps`,
            {
              headers: { Authorization: `Bearer ${token}` },
              cache: "no-store",
            }
          );
          if (!response.ok) {
            const details = await response.text();
            console.error(
              `Strava lap request failed (${response.status}) for activity ${activity.id}: ${details}`
            );
            throw new Error(
              "ไม่สามารถโหลดรอบวิ่ง interval จาก Strava ได้ ข้อมูลกิจกรรมยังไม่ถูกบันทึก"
            );
          }
          const rawLaps: unknown = await response.json();
          if (!Array.isArray(rawLaps)) {
            throw new Error(`Strava returned invalid lap data for activity ${activity.id}`);
          }
          activity.laps = (rawLaps as StravaActivityLap[]).map(toLap);
        }
      }
    );
    await Promise.all(workers);

    await saveWeeklyActivities(athlete.id, weekStart, activities);
    const sync = await getWeeklyActivitySync(athlete.id, weekStart);

    return NextResponse.json({
      connected: true,
      athleteName,
      activities,
      source: "strava",
      cached: false,
      syncedAt: sync?.syncedAt,
    });
  } catch (error) {
    console.error("Error loading and saving weekly Strava data:", error);
    return NextResponse.json(
      {
        connected: false,
        message:
          error instanceof Error
            ? error.message
            : "เกิดข้อผิดพลาดขณะโหลดกิจกรรม Strava",
      },
      { status: 503 }
    );
  }
}
