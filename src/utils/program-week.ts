import defaultProgram from "@/data/program.json";
import { ProgramConfig } from "@/types";

const FIRST_WEEK_START = "2026-11-02";

export function getCurrentThailandWeekStart(
  now: Date = new Date()
): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = (type: string) => parts.find((part) => part.type === type)?.value;
  const localDate = `${value("year")}-${value("month")}-${value("day")}`;
  const weekStart = new Date(`${localDate}T00:00:00Z`);
  weekStart.setUTCDate(
    weekStart.getUTCDate() - ((weekStart.getUTCDay() + 6) % 7)
  );
  return weekStart.toISOString().slice(0, 10);
}

export function getDefaultWeek(value: string): ProgramConfig {
  const firstWeek = new Date(`${FIRST_WEEK_START}T00:00:00Z`).getTime();
  const selectedWeek = new Date(`${value}T00:00:00Z`).getTime();
  const weekNumber =
    Math.floor((selectedWeek - firstWeek) / (7 * 24 * 60 * 60 * 1000)) + 1;
  const start = new Date(`${value}T00:00:00Z`);
  const end = new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000);
  const dateRange = `${start.getUTCDate()}-${end.getUTCDate()} ${end.toLocaleString(
    "en",
    {
      month: "long",
      timeZone: "UTC",
    }
  )}`;

  return {
    ...(defaultProgram as ProgramConfig),
    weekStartDate: value,
    weekTitle: `สัปดาห์ที่ ${weekNumber} : ${dateRange}`,
  };
}
