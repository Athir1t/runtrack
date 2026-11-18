import type {
  Athlete,
  OverallAthleteSummary,
  ProgramConfig,
} from "@/types";
import type { AllWeeklyAthleteActivitySummary } from "@/utils/database";
import {
  getCreditedTrainingDayCount,
  getWeeklyTargetKm,
} from "@/utils/program";

export interface OverallWeekData {
  weekStart: string;
  program: ProgramConfig;
  activitySummary?: AllWeeklyAthleteActivitySummary;
}

function getWeekDayIndex(date: string, weekStart: string): number | null {
  const dateTime = Date.parse(`${date}T00:00:00Z`);
  const weekTime = Date.parse(`${weekStart}T00:00:00Z`);
  if (!Number.isFinite(dateTime) || !Number.isFinite(weekTime)) return null;
  const index = Math.floor((dateTime - weekTime) / 86_400_000);
  return index >= 0 && index < 7 ? index : null;
}

export function summarizeAthleteAcrossWeeks(
  athlete: Pick<Athlete, "id" | "nickname" | "gender">,
  weeks: OverallWeekData[]
): OverallAthleteSummary {
  let distanceKm = 0;
  let targetKm = 0;
  let hasCompleteTargets = weeks.length > 0;
  let trainingDays = 0;
  let programTrainingDays = 0;

  for (const week of weeks) {
    const { schedule } = week.program;
    const weekTarget = getWeeklyTargetKm(schedule, athlete.gender);
    if (weekTarget === null) {
      hasCompleteTargets = false;
    } else {
      targetKm += weekTarget;
    }

    programTrainingDays += schedule.filter((day) => !day.isRest).length;
    const summary = week.activitySummary;
    if (!summary) continue;

    distanceKm += summary.distanceKm;
    const activityDayIndexes = summary.validActivityDates
      .map((date) => getWeekDayIndex(date, week.weekStart))
      .filter((index): index is number => index !== null);
    trainingDays += getCreditedTrainingDayCount(schedule, activityDayIndexes);
  }

  const roundedDistanceKm = Number(distanceKm.toFixed(1));
  const roundedTargetKm =
    hasCompleteTargets && targetKm > 0 ? Number(targetKm.toFixed(1)) : null;
  return {
    ...athlete,
    distanceKm: roundedDistanceKm,
    targetKm: roundedTargetKm,
    trainingDays,
    programTrainingDays,
    percent:
      roundedTargetKm === null
        ? null
        : Math.round((roundedDistanceKm / roundedTargetKm) * 100),
  };
}
