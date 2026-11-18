import type {
  Athlete,
  EvaluatedAthlete,
  OverallSummaryResponse,
  ProgramConfig,
  StravaActivity,
} from "@/types";
import { formatProgramKm, getDayTargetKm, getThaiDayName } from "@/utils/program";
import { getWorkoutType } from "@/utils/workout";

type CsvValue = string | number | boolean | null | undefined;

function escapeCsvValue(value: CsvValue): string {
  let text = value == null ? "" : String(value);
  if (/^[\s]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadCsv(filename: string, rows: CsvValue[][]): void {
  const contents = `\uFEFF${rows
    .map((row) => row.map(escapeCsvValue).join(","))
    .join("\r\n")}`;
  const blob = new Blob([contents], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportProgramCsv(program: ProgramConfig): void {
  const rows: CsvValue[][] = [
    ["สัปดาห์", program.weekTitle],
    ["วันเริ่มต้น", program.weekStartDate],
    [],
    [
      "วัน",
      "โปรแกรม",
      "คำอธิบายเพิ่มเติม",
      "รายละเอียด",
      "วันพัก",
      "วันแข่งขัน",
      "เป้าหมายชาย (กม.)",
      "เป้าหมายหญิง (กม.)",
    ],
    ...program.schedule.map((day, index) => [
      getThaiDayName(day.day, index),
      day.title,
      day.subtitle,
      day.detail,
      day.isRest ? "ใช่" : "ไม่ใช่",
      day.isRace ? "ใช่" : "ไม่ใช่",
      formatProgramKm(getDayTargetKm(day, "M")),
      formatProgramKm(getDayTargetKm(day, "F")),
    ]),
  ];
  downloadCsv(`program-week-${program.weekStartDate}.csv`, rows);
}

export function exportAthletesCsv(
  program: ProgramConfig,
  athletes: EvaluatedAthlete[]
): void {
  const schedule = program.schedule;
  const rows: CsvValue[][] = [
    [
      "อันดับ",
      "รหัสนักกีฬา",
      "ชื่อเล่น",
      "ชื่อ Strava",
      "เพศ",
      ...schedule.map(
        (day, index) =>
          `${getThaiDayName(day.day, index)} - ${day.title}`
      ),
      "วันซ้อม",
      "วันฝึกตามโปรแกรม",
      "ระยะรวม (กม.)",
      "เป้าหมาย (กม.)",
      "% โปรแกรม",
      "สถานะ",
      "เหตุผล",
    ],
    ...athletes.map((athlete) => [
      athlete.isSynced === false ? "—" : athlete.rank,
      athlete.id,
      athlete.nickname,
      athlete.stravaName,
      athlete.gender === "F" ? "หญิง" : "ชาย",
      ...schedule.map((day, index) => {
        if (athlete.isSynced === false) return "ยังไม่ซิงค์";
        if (day.isRest) {
          return athlete.trainingDayIndexes?.includes(index)
            ? "วิ่งชดเชยในวันพัก"
            : "วันพัก";
        }
        return athlete.trainingDayIndexes?.includes(index)
          ? "ซ้อมแล้ว"
          : "ขาดซ้อม";
      }),
      athlete.isSynced === false
        ? "—"
        : athlete.trainingDays ?? athlete.runsCount,
      athlete.programTrainingDays,
      athlete.isSynced === false ? "—" : athlete.distanceKm.toFixed(1),
      athlete.targetKm === null ? "Null" : athlete.targetKm.toFixed(1),
      athlete.isSynced === false
        ? "—"
        : athlete.percent === null
          ? "Null"
          : `${athlete.percent}%`,
      athlete.isSynced === false
        ? "ยังไม่ซิงค์"
        : athlete.status === "completed"
          ? "ครบโปรแกรม"
          : athlete.status === "almost"
            ? "เกือบครบ"
            : "ยังไม่ครบ",
      athlete.isSynced === false ? "" : athlete.statusReason,
    ]),
  ];
  downloadCsv(`athletes-week-${program.weekStartDate}.csv`, rows);
}

export function exportOverallSummaryCsv(
  summary: OverallSummaryResponse
): void {
  const firstWeek = summary.weeks[0] || "unknown";
  const lastWeek = summary.weeks[summary.weeks.length - 1] || "unknown";
  const rows: CsvValue[][] = [
    ["สรุปรวมทุกสัปดาห์", `${firstWeek} - ${lastWeek}`],
    ["จำนวนสัปดาห์", summary.weeks.length],
    [],
    [
      "อันดับ",
      "รหัสนักกีฬา",
      "ชื่อเล่น",
      "เพศ",
      "ระยะรวม (กม.)",
      "วันซ้อม",
      "วันฝึกตามโปรแกรม",
      "เป้าหมายรวม (กม.)",
      "% โปรแกรม",
    ],
    ...summary.athletes.map((athlete, index) => [
      index + 1,
      athlete.id,
      athlete.nickname,
      athlete.gender === "F" ? "หญิง" : "ชาย",
      athlete.distanceKm.toFixed(1),
      athlete.trainingDays,
      athlete.programTrainingDays,
      athlete.targetKm === null ? "Null" : athlete.targetKm.toFixed(1),
      athlete.percent === null ? "Null" : `${athlete.percent}%`,
    ]),
  ];
  downloadCsv(`overall-summary-${firstWeek}-to-${lastWeek}.csv`, rows);
}

function formatActivityDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

function formatActivityPace(activity: StravaActivity): string {
  if (activity.distanceKm <= 0) return "";
  const secondsPerKm = Math.round(
    activity.movingTimeSeconds / activity.distanceKm
  );
  return `${Math.floor(secondsPerKm / 60)}:${String(
    secondsPerKm % 60
  ).padStart(2, "0")}`;
}

export function exportDailyActivitiesCsv(
  program: ProgramConfig,
  dayIndex: number,
  athletes: Athlete[],
  activities: StravaActivity[]
): void {
  const day = program.schedule[dayIndex];
  if (!day) throw new Error("Cannot export activities for an unknown program day.");
  const activityDate = new Date(`${program.weekStartDate}T00:00:00Z`);
  activityDate.setUTCDate(activityDate.getUTCDate() + dayIndex);
  const activitiesByAthlete = new Map<string, StravaActivity[]>();
  for (const activity of activities) {
    const athleteActivities = activitiesByAthlete.get(activity.athleteId || "");
    if (athleteActivities) athleteActivities.push(activity);
    else activitiesByAthlete.set(activity.athleteId || "", [activity]);
  }

  const rows: CsvValue[][] = [
    ["วันที่", activityDate.toISOString().slice(0, 10)],
    ["วัน", getThaiDayName(day.day, dayIndex)],
    ["โปรแกรม", `${day.title}${day.subtitle ? ` ${day.subtitle}` : ""}`],
    ["ประเภทการซ้อม", getWorkoutType(day)],
    [],
    [
      "รหัสนักกีฬา",
      "ชื่อเล่น",
      "เพศ",
      "เป้าหมายรายวัน (กม.)",
      "กิจกรรม",
      "ระยะทาง (กม.)",
      "เวลา (นาที:วินาที)",
      "เพซ (นาที/กม.)",
      "เวลาเริ่ม",
      "แหล่งข้อมูล",
    ],
    ...athletes
      .filter((athlete) => athlete.inClub)
      .flatMap((athlete) => {
        const athleteActivities = activitiesByAthlete.get(athlete.id) || [];
        const targetKm = getDayTargetKm(day, athlete.gender);
        const commonValues = [
          athlete.id,
          athlete.nickname,
          athlete.gender === "F" ? "หญิง" : "ชาย",
          targetKm === null ? "Null" : targetKm.toFixed(1),
        ];
        if (athleteActivities.length === 0) {
          return [[...commonValues, "ไม่พบกิจกรรม", "", "", "", "", ""]];
        }
        return athleteActivities.map((activity) => [
          ...commonValues,
          activity.name,
          activity.distanceKm.toFixed(1),
          formatActivityDuration(activity.movingTimeSeconds),
          formatActivityPace(activity),
          activity.startDateLocal || "",
          activity.source === "manual" ? "บันทึกเอง" : "Strava",
        ]);
      }),
  ];
  downloadCsv(
    `activities-${program.weekStartDate}-day-${dayIndex + 1}.csv`,
    rows
  );
}
