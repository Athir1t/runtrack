import { NextResponse } from "next/server";
import { isAdminRequest } from "@/utils/admin-auth";

function getCurrentWeekStart(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = (type: string) => parts.find((part) => part.type === type)?.value;
  const localDate = `${value("year")}-${value("month")}-${value("day")}`;
  const start = new Date(`${localDate}T00:00:00Z`);
  const daysSinceMonday = (start.getUTCDay() + 6) % 7;
  start.setUTCDate(start.getUTCDate() - daysSinceMonday);
  return start.toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: "Admin login required." }, { status: 401 });
  }

  const { searchParams, origin } = new URL(request.url);
  const requestedWeek = searchParams.get("weekStart") || getCurrentWeekStart();
  const parsedWeek = new Date(`${requestedWeek}T00:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(requestedWeek) ||
    Number.isNaN(parsedWeek.getTime()) ||
    parsedWeek.toISOString().slice(0, 10) !== requestedWeek
  ) {
    return NextResponse.json({ error: "Invalid weekStart date." }, { status: 400 });
  }

  const target = new URL("/api/strava/activities", origin);
  target.searchParams.set("weekStart", requestedWeek);
  target.searchParams.set("refresh", "1");
  return NextResponse.redirect(target);
}
