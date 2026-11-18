import { NextResponse } from "next/server";
import {
  getRequestAthleteSession,
  isAdminRequest,
} from "@/utils/admin-auth";
import {
  getAllWeeklyAthleteActivitySummaries,
  getAthletes,
  getWeeklyProgram,
  getWeeklyProgramsThroughDate,
} from "@/utils/database";
import { getDefaultWeek } from "@/utils/program-week";
import { OverallWeekData, summarizeAthleteAcrossWeeks } from "@/utils/overall-summary";

export const dynamic = "force-dynamic";

function privateJson(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Vary", "Cookie");
  return response;
}

function todayInThailand(): string {
  const dateParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: string) => dateParts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export async function GET(request: Request) {
  try {
    const [isAdmin, athleteSession] = await Promise.all([
      isAdminRequest(request),
      getRequestAthleteSession(request),
    ]);
    if (!isAdmin && !athleteSession) {
      return privateJson({ error: "Sign in to view team summaries." }, { status: 401 });
    }

    const throughDate = todayInThailand();
    const [roster, savedPrograms, activitySummaries] = await Promise.all([
      getAthletes(),
      getWeeklyProgramsThroughDate(throughDate),
      getAllWeeklyAthleteActivitySummaries(throughDate),
    ]);
    const programByWeek = new Map(
      savedPrograms.map((week) => [week.weekStart, week.program])
    );
    const weekStarts = Array.from(
      new Set([
        ...savedPrograms.map((week) => week.weekStart),
        ...activitySummaries.map((summary) => summary.weekStart),
      ])
    ).sort();
    const weeklyPrograms = await Promise.all(
      weekStarts.map(async (weekStart) => ({
        weekStart,
        program:
          programByWeek.get(weekStart) ||
          (await getWeeklyProgram(weekStart)) ||
          getDefaultWeek(weekStart),
      }))
    );
    const summariesByWeekAndAthlete = new Map(
      activitySummaries.map((summary) => [
        `${summary.weekStart}:${summary.athleteId}`,
        summary,
      ])
    );
    const weeks: OverallWeekData[] = weeklyPrograms.map((week) => ({
      ...week,
    }));
    const athletes = roster
      .filter((athlete) => athlete.inClub)
      .map((athlete) =>
        summarizeAthleteAcrossWeeks(
          athlete,
          weeks.map((week) => ({
            ...week,
            activitySummary: summariesByWeekAndAthlete.get(
              `${week.weekStart}:${athlete.id}`
            ),
          }))
        )
      )
      .sort((a, b) => {
        if (a.percent === null && b.percent !== null) return 1;
        if (b.percent === null && a.percent !== null) return -1;
        return (
          (b.percent ?? 0) - (a.percent ?? 0) ||
          b.distanceKm - a.distanceKm
        );
      });

    return privateJson({ weeks: weekStarts, athletes });
  } catch (error) {
    console.error("Error loading overall team summary:", error);
    return privateJson(
      { error: "ไม่สามารถโหลดสรุปรวมทุกสัปดาห์ได้" },
      { status: 503 }
    );
  }
}
