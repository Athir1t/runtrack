"use client";

import React, { useEffect, useState } from "react";
import { ArrowLeft, Download } from "lucide-react";
import type {
  Athlete,
  DaySchedule,
  ProgramConfig,
  StravaActivity,
} from "@/types";
import {
  ConnectWithStravaButton,
  PoweredByStravaLogo,
  StravaIcon,
} from "@/components/StravaBrand";
import { ThemeToggle } from "@/components/ThemeToggle";
import { exportDailyActivitiesCsv } from "@/utils/csv-export";
import { getDayTargetKm, getThaiDayName } from "@/utils/program";
import { getWorkoutType } from "@/utils/workout";

interface DailyActivitiesResponse {
  authenticated: boolean;
  athletes: Athlete[];
  activities: StravaActivity[];
  program: ProgramConfig;
  message?: string;
}

interface DailyReport {
  weekStart: string;
  dayIndex: number;
  data: DailyActivitiesResponse;
}

function isValidWeekStart(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

function formatDate(dateString: string): string {
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(`${dateString}T00:00:00Z`));
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(
      remainingSeconds
    ).padStart(2, "0")}`;
  }
  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

function formatPace(activity: StravaActivity): string {
  if (activity.distanceKm <= 0) return "—";
  const secondsPerKm = Math.round(
    activity.movingTimeSeconds / activity.distanceKm
  );
  return `${Math.floor(secondsPerKm / 60)}:${String(
    secondsPerKm % 60
  ).padStart(2, "0")}`;
}

function formatStartTime(activity: StravaActivity): string {
  const localTime = activity.startDateLocal?.slice(11, 16);
  if (localTime && /^\d{2}:\d{2}$/.test(localTime)) return localTime;
  if (!activity.startDate) return "—";
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: "Asia/Bangkok",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(activity.startDate));
}

function getDayDate(weekStart: string, dayIndex: number): string {
  const date = new Date(`${weekStart}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + dayIndex);
  return date.toISOString().slice(0, 10);
}

function getDayTarget(day: DaySchedule, athlete: Athlete): string {
  const target = getDayTargetKm(day, athlete.gender);
  return target === null ? "Null" : `${target.toFixed(1)} กม.`;
}

export default function DailyActivitiesPage() {
  const [report, setReport] = useState<DailyReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const searchParams = new URLSearchParams(window.location.search);
    const weekStart = searchParams.get("weekStart");
    const dayIndexParam = searchParams.get("dayIndex");
    const dayIndex =
      dayIndexParam !== null && /^[0-6]$/.test(dayIndexParam)
        ? Number(dayIndexParam)
        : null;
    if (
      !isValidWeekStart(weekStart) ||
      dayIndex === null
    ) {
      setError("ลิงก์วันโปรแกรมไม่ถูกต้อง");
      setIsLoading(false);
      return () => controller.abort();
    }
    const validWeekStart = weekStart;
    const validDayIndex = dayIndex;

    async function loadDayActivities() {
      try {
        const response = await fetch(
          `/api/strava/activities?weekStart=${encodeURIComponent(
            validWeekStart
          )}&dayIndex=${validDayIndex}`,
          { cache: "no-store", signal: controller.signal }
        );
        const data = (await response.json()) as DailyActivitiesResponse;
        if (!response.ok) {
          throw new Error(data.message || "ไม่สามารถโหลดกิจกรรมของวันนี้ได้");
        }
        setReport({
          weekStart: validWeekStart,
          dayIndex: validDayIndex,
          data,
        });
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "ไม่สามารถโหลดกิจกรรมของวันนี้ได้"
          );
        }
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }

    void loadDayActivities();
    return () => controller.abort();
  }, []);

  const selectedDay =
    report?.data.program.schedule[report.dayIndex] || null;
  const isIntervalDay =
    selectedDay !== null && getWorkoutType(selectedDay) === "interval";
  const clubAthletes =
    report?.data.athletes.filter((athlete) => athlete.inClub) || [];
  const activities = report?.data.activities || [];
  const activitiesByAthlete = new Map<string, StravaActivity[]>();
  for (const activity of activities) {
    const athleteActivities = activitiesByAthlete.get(activity.athleteId || "");
    if (athleteActivities) athleteActivities.push(activity);
    else activitiesByAthlete.set(activity.athleteId || "", [activity]);
  }
  const activityRows: Array<{
    athlete: Athlete;
    activity: StravaActivity | null;
  }> = clubAthletes.flatMap(
    (athlete): Array<{ athlete: Athlete; activity: StravaActivity | null }> => {
      const athleteActivities = activitiesByAthlete.get(athlete.id) || [];
      return athleteActivities.length > 0
        ? athleteActivities.map((activity) => ({ athlete, activity }))
        : [{ athlete, activity: null }];
    }
  );
  const totalDistanceKm = activities.reduce(
    (total, activity) => total + activity.distanceKm,
    0
  );
  const athletesWithActivities = activitiesByAthlete.size;

  return (
    <main className="min-h-screen bg-kmutt-dark p-4 text-gray-100 sm:p-6 md:p-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex items-center justify-between gap-3">
          <a
            href="/"
            className="inline-flex items-center gap-2 rounded-lg border border-kmutt-border px-3 py-2 text-sm font-semibold text-gray-300 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kmutt-orange"
          >
            <ArrowLeft className="h-4 w-4" />
            กลับหน้าโปรแกรม
          </a>
          <ThemeToggle />
        </header>

        {isLoading ? (
          <section className="rounded-2xl border border-kmutt-border bg-kmutt-card p-10 text-center text-sm text-gray-400">
            กำลังโหลดกิจกรรมของทุกคน...
          </section>
        ) : error ? (
          <section className="rounded-2xl border border-red-500/30 bg-kmutt-card p-8 text-center">
            <p className="text-sm text-red-400" role="alert">
              {error}
            </p>
          </section>
        ) : report && !report.data.authenticated ? (
          <section className="rounded-2xl border border-kmutt-border bg-kmutt-card p-6 text-center shadow-xl sm:p-10">
            <h1 className="text-xl font-bold text-white">
              เข้าสู่ระบบเพื่อดูกิจกรรมของทีม
            </h1>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-gray-400">
              ข้อมูลกิจกรรมรายบุคคลจะแสดงเฉพาะผู้ที่เชื่อมต่อ Strava หรือผู้ดูแลระบบเท่านั้น
            </p>
            <div className="mt-6 flex flex-col items-center justify-center gap-4">
              <ConnectWithStravaButton />
              <a
                href="/?admin=login"
                className="text-sm font-semibold text-kmutt-orange underline-offset-2 hover:underline"
              >
                เข้าสู่ระบบสำหรับโค้ช / ผู้ดูแล
              </a>
            </div>
          </section>
        ) : report && selectedDay ? (
          <>
            <section className="mb-5 rounded-2xl border border-kmutt-border bg-kmutt-card p-5 shadow-xl sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold text-kmutt-orange">
                    {getThaiDayName(selectedDay.day, report.dayIndex)} ·{" "}
                    {formatDate(getDayDate(report.weekStart, report.dayIndex))}
                  </p>
                  <h1 className="mt-1 text-2xl font-bold text-white">
                    {selectedDay.title}
                    {selectedDay.subtitle ? ` ${selectedDay.subtitle}` : ""}
                  </h1>
                  {selectedDay.detail && (
                    <p className="mt-2 whitespace-pre-line text-sm leading-6 text-gray-400">
                      {selectedDay.detail}
                    </p>
                  )}
                  <p className="mt-2 text-xs text-gray-500">
                    {report.data.program.weekTitle}
                  </p>
                  {isIntervalDay && (
                    <p className="mt-1 text-xs text-gray-500">
                      ไม่แสดงข้อมูลรอบวิ่ง (laps) ในรายงานและ CSV
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    exportDailyActivitiesCsv(
                      report.data.program,
                      report.dayIndex,
                      clubAthletes,
                      activities
                    )
                  }
                  className="inline-flex items-center gap-2 rounded-lg border border-kmutt-orange/40 px-3 py-2 text-sm font-semibold text-kmutt-orange hover:bg-kmutt-orange/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kmutt-orange"
                >
                  <Download className="h-4 w-4" />
                  ส่งออก CSV
                </button>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
                <div className="rounded-xl border border-kmutt-border bg-kmutt-dark p-3">
                  <span className="block text-xs text-gray-400">กิจกรรม</span>
                  <span className="mt-1 block text-lg font-bold text-white">
                    {activities.length}
                  </span>
                </div>
                <div className="rounded-xl border border-kmutt-border bg-kmutt-dark p-3">
                  <span className="block text-xs text-gray-400">นักกีฬาที่มีกิจกรรม</span>
                  <span className="mt-1 block text-lg font-bold text-white">
                    {athletesWithActivities}/{clubAthletes.length}
                  </span>
                </div>
                <div className="col-span-2 rounded-xl border border-kmutt-border bg-kmutt-dark p-3 sm:col-span-1">
                  <span className="block text-xs text-gray-400">ระยะรวม</span>
                  <span className="mt-1 block text-lg font-bold text-white">
                    {totalDistanceKm.toFixed(1)} กม.
                  </span>
                </div>
              </div>
            </section>

            <section className="overflow-hidden rounded-2xl border border-kmutt-border bg-kmutt-card shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[850px] text-left text-sm">
                  <thead className="bg-black/20 text-xs text-gray-400">
                    <tr className="border-b border-kmutt-border">
                      <th className="px-4 py-3">นักกีฬา</th>
                      <th className="px-4 py-3">กิจกรรม</th>
                      <th className="px-4 py-3 text-right">เป้าหมาย</th>
                      <th className="px-4 py-3 text-right">ระยะทาง</th>
                      <th className="px-4 py-3 text-right">เวลา</th>
                      <th className="px-4 py-3 text-right">เพซ</th>
                      <th className="px-4 py-3 text-right">เวลาเริ่ม</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-kmutt-border/50">
                    {activityRows.map(({ athlete, activity }, index) => (
                      <tr key={`${athlete.id}-${activity?.id ?? "none"}-${index}`}>
                        <td className="px-4 py-3">
                          <span className="font-semibold text-white">
                            {athlete.nickname}
                          </span>
                          <span
                            className={`ml-1.5 text-xs ${
                              athlete.gender === "F"
                                ? "text-pink-300"
                                : "text-sky-300"
                            }`}
                          >
                            ({athlete.gender === "F" ? "หญิง" : "ชาย"})
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {activity ? (
                            <div className="flex items-center gap-2">
                              {activity.source !== "manual" && activity.id > 0 ? (
                                <a
                                  href={`https://www.strava.com/activities/${activity.id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  aria-label="เปิดกิจกรรมใน Strava"
                                >
                                  <StravaIcon className="h-4 w-4" />
                                </a>
                              ) : null}
                              <span className="text-gray-200">
                                {activity.name || "วิ่ง"}
                              </span>
                              {activity.source === "manual" && (
                                <span className="text-[10px] text-gray-500">
                                  บันทึกเอง
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-500">ไม่มีข้อมูลกิจกรรม</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-300">
                          {getDayTarget(selectedDay, athlete)}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-white">
                          {activity ? `${activity.distanceKm.toFixed(1)} กม.` : "—"}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-300">
                          {activity
                            ? formatDuration(activity.movingTimeSeconds)
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-300">
                          {activity ? `${formatPace(activity)} /กม.` : "—"}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-400">
                          {activity ? formatStartTime(activity) : "—"}
                        </td>
                      </tr>
                    ))}
                    {activityRows.length === 0 && (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-4 py-10 text-center text-sm text-gray-400"
                        >
                          ยังไม่มีนักกีฬาในทีม
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
            <div className="mt-4 flex justify-end">
              <PoweredByStravaLogo />
            </div>
          </>
        ) : null}
      </div>
    </main>
  );
}
