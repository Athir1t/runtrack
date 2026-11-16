import { NextResponse } from "next/server";
import { DaySchedule, ProgramConfig } from "@/types";
import { getWeeklyProgram, saveWeeklyProgram } from "@/utils/database";
import { isAdminRequest } from "@/utils/admin-auth";
import { getDefaultWeek } from "@/utils/program-week";
import { withDerivedProgramTargets } from "@/utils/program";
const FIRST_WEEK_START = "2026-11-02";

function isValidWeekStart(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime()) &&
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isOptionalTarget(value: unknown, isRest: boolean): boolean {
  return (
    value === undefined ||
    value === null ||
    (typeof value === "number" &&
      Number.isFinite(value) &&
      (isRest ? value >= 0 : value > 0))
  );
}

function parseProgram(value: unknown): ProgramConfig | null {
  if (
    !isRecord(value) ||
    typeof value.weekTitle !== "string" ||
    !isRecord(value.criteria) ||
    !Array.isArray(value.schedule) ||
    value.schedule.length !== 7
  ) {
    return null;
  }

  const { criteria } = value;
  const almostMinRuns = criteria.almostMinRuns;
  const fullMinPercent = criteria.fullMinPercent;
  const almostMinPercent = criteria.almostMinPercent;
  if (
    typeof almostMinRuns !== "number" ||
    !Number.isInteger(almostMinRuns) ||
    almostMinRuns < 0 ||
    almostMinRuns > 7 ||
    fullMinPercent !== undefined &&
      (typeof fullMinPercent !== "number" ||
        !Number.isFinite(fullMinPercent) ||
        fullMinPercent < 0 ||
        fullMinPercent > 100) ||
    almostMinPercent !== undefined &&
      (typeof almostMinPercent !== "number" ||
        !Number.isFinite(almostMinPercent) ||
        almostMinPercent < 0 ||
        almostMinPercent > 100)
  ) {
    return null;
  }

  const schedule: DaySchedule[] = [];
  for (const day of value.schedule) {
    if (!isRecord(day)) return null;

    const {
      day: dayName,
      title,
      subtitle,
      detail,
      isRest,
      isRace,
      targetMaleKm,
      targetFemaleKm,
    } = day;
    if (
      typeof dayName !== "string" ||
      !dayName.trim() ||
      dayName.length > 30 ||
      typeof title !== "string" ||
      title.length > 200 ||
      subtitle !== undefined &&
        subtitle !== null &&
        (typeof subtitle !== "string" || subtitle.length > 120) ||
      detail !== undefined &&
        detail !== null &&
        (typeof detail !== "string" || detail.length > 2000) ||
      isRest !== undefined && typeof isRest !== "boolean" ||
      isRace !== undefined && typeof isRace !== "boolean" ||
      !isOptionalTarget(targetMaleKm, isRest === true) ||
      !isOptionalTarget(targetFemaleKm, isRest === true)
    ) {
      return null;
    }

    schedule.push({
      day: dayName,
      title,
      subtitle: typeof subtitle === "string" ? subtitle : undefined,
      detail: typeof detail === "string" ? detail : undefined,
      isRest: typeof isRest === "boolean" ? isRest : undefined,
      isRace: typeof isRace === "boolean" ? isRace : undefined,
      targetMaleKm:
        typeof targetMaleKm === "number" || targetMaleKm === null
          ? targetMaleKm
          : undefined,
      targetFemaleKm:
        typeof targetFemaleKm === "number" || targetFemaleKm === null
          ? targetFemaleKm
          : undefined,
    });
  }

  return withDerivedProgramTargets({
    weekTitle: value.weekTitle,
    targetMaleKm: null,
    targetFemaleKm: null,
    weekStartDate:
      typeof value.weekStartDate === "string" ? value.weekStartDate : "",
    criteria: {
      fullMinRuns: undefined,
      fullMinPercent: typeof fullMinPercent === "number" ? fullMinPercent : undefined,
      almostMinRuns,
      almostMinPercent: typeof almostMinPercent === "number" ? almostMinPercent : undefined,
    },
    schedule,
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const weekStart = searchParams.get("weekStart") || FIRST_WEEK_START;
  if (!isValidWeekStart(weekStart)) {
    return NextResponse.json({ error: "วันที่เริ่มสัปดาห์ไม่ถูกต้อง" }, { status: 400 });
  }

  try {
    const program = await getWeeklyProgram(weekStart);
    if (program) return NextResponse.json(program);
  } catch (err) {
    console.error("Error reading weekly program from PostgreSQL:", err);
    return NextResponse.json(
      { error: "ไม่สามารถโหลดโปรแกรมจาก PostgreSQL ได้" },
      { status: 503 }
    );
  }

  return NextResponse.json(getDefaultWeek(weekStart));
}

export async function POST(req: Request) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: "Admin login required." }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const weekStart = searchParams.get("weekStart");
    if (!weekStart || !isValidWeekStart(weekStart)) {
      return NextResponse.json({ error: "วันที่เริ่มสัปดาห์ไม่ถูกต้อง" }, { status: 400 });
    }

    const updated = parseProgram(await req.json());
    if (!updated) {
      return NextResponse.json(
        { success: false, error: "ข้อมูลโปรแกรมรายวันไม่ถูกต้อง" },
        { status: 400 }
      );
    }
    await saveWeeklyProgram(weekStart, updated);
    return NextResponse.json({
      success: true,
      program: withDerivedProgramTargets({ ...updated, weekStartDate: weekStart }),
    });
  } catch (err) {
    console.error("Error saving weekly program to PostgreSQL:", err);
    return NextResponse.json(
      { success: false, error: "ไม่สามารถบันทึกโปรแกรมใน PostgreSQL ได้" },
      { status: 503 }
    );
  }
}
