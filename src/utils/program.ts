import { DaySchedule, ProgramConfig } from "@/types";

const THAI_WEEKDAYS = [
  "วันจันทร์",
  "วันอังคาร",
  "วันพุธ",
  "วันพฤหัสบดี",
  "วันศุกร์",
  "วันเสาร์",
  "วันอาทิตย์",
] as const;

const WEEKDAY_NAMES: Record<string, (typeof THAI_WEEKDAYS)[number]> = {
  จ: "วันจันทร์",
  จันทร์: "วันจันทร์",
  อ: "วันอังคาร",
  อังคาร: "วันอังคาร",
  พ: "วันพุธ",
  พุธ: "วันพุธ",
  พฤ: "วันพฤหัสบดี",
  พฤหัสบดี: "วันพฤหัสบดี",
  ศ: "วันศุกร์",
  ศุกร์: "วันศุกร์",
  ส: "วันเสาร์",
  เสาร์: "วันเสาร์",
  อา: "วันอาทิตย์",
  อาทิตย์: "วันอาทิตย์",
};

export function getThaiDayName(day: string, index?: number): string {
  const normalized = day.trim().replace(/^วัน/, "");
  return (
    WEEKDAY_NAMES[normalized] ||
    (index !== undefined ? THAI_WEEKDAYS[index] : undefined) ||
    day
  );
}

export function getDayTargetKm(
  day: DaySchedule,
  gender: "M" | "F"
): number | null {
  if (day.isRest) return 0;
  const target = gender === "F" ? day.targetFemaleKm : day.targetMaleKm;
  return typeof target === "number" && Number.isFinite(target) && target > 0
    ? target
    : null;
}

export function getWeeklyTargetKm(
  schedule: DaySchedule[],
  gender: "M" | "F"
): number | null {
  const targets = schedule
    .filter((day) => !day.isRest)
    .map((day) => getDayTargetKm(day, gender));
  if (targets.some((target) => target === null)) return null;
  return Number(
    targets.reduce<number>((total, target) => total + (target ?? 0), 0).toFixed(1)
  );
}

export function getCreditedTrainingDayCount(
  schedule: DaySchedule[],
  activityDayIndexes: number[]
): number {
  const scheduledTrainingDays = schedule.filter((day) => !day.isRest).length;
  const activeDays = new Set(
    activityDayIndexes.filter(
      (dayIndex) =>
        Number.isInteger(dayIndex) &&
        dayIndex >= 0 &&
        dayIndex < schedule.length
    )
  );
  return Math.min(scheduledTrainingDays, activeDays.size);
}

export function withDerivedProgramTargets(
  program: ProgramConfig
): ProgramConfig {
  const schedule = program.schedule;
  return {
    ...program,
    targetMaleKm: getWeeklyTargetKm(schedule, "M"),
    targetFemaleKm: getWeeklyTargetKm(schedule, "F"),
    criteria: {
      ...program.criteria,
      fullMinRuns: schedule.filter((day) => !day.isRest).length,
    },
    schedule,
  };
}

export function formatProgramKm(value: number | null | undefined): string {
  return value == null ? "Null" : value.toFixed(1);
}
