import { EvaluatedAthlete, ProgramConfig } from "@/types";
import { formatProgramKm, getDayTargetKm, getThaiDayName } from "@/utils/program";

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
        if (day.isRest) return "วันพัก";
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
