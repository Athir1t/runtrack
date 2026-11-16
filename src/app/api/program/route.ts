import { NextResponse } from "next/server";
import { ProgramConfig } from "@/types";
import { getWeeklyProgram, saveWeeklyProgram } from "@/utils/database";
import { isAdminRequest } from "@/utils/admin-auth";
import { getDefaultWeek } from "@/utils/program-week";
const FIRST_WEEK_START = "2026-11-02";

function isValidWeekStart(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime()) &&
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
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

    const updated: ProgramConfig = await req.json();
    await saveWeeklyProgram(weekStart, updated);
    return NextResponse.json({
      success: true,
      program: { ...updated, weekStartDate: weekStart },
    });
  } catch (err: any) {
    console.error("Error saving weekly program to PostgreSQL:", err);
    return NextResponse.json(
      { success: false, error: "ไม่สามารถบันทึกโปรแกรมใน PostgreSQL ได้" },
      { status: 503 }
    );
  }
}
