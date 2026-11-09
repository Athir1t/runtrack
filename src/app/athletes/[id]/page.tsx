"use client";

import React, { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Activity, ArrowLeft, ChevronDown, ExternalLink } from "lucide-react";
import { Athlete, ProgramConfig, StravaActivity } from "@/types";
import { getWorkoutType, workoutStyles } from "@/utils/workout";

const FIRST_WEEK_START = "2026-11-02";
const WEEKDAY_NAMES = ["จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์", "อาทิตย์"];

interface ActivityResponse {
  authenticated: boolean;
  activities: StravaActivity[];
  message?: string;
}

function getLocalDate(activity: StravaActivity): string {
  if (activity.startDateLocal) return activity.startDateLocal.slice(0, 10);
  const date = new Date(activity.startDate);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function formatLocalTime(activity: StravaActivity): string {
  if (activity.startDateLocal) {
    const time = activity.startDateLocal.slice(11, 16);
    if (/^\d{2}:\d{2}$/.test(time)) return time;
  }
  const date = new Date(activity.startDate);
  if (Number.isNaN(date.getTime())) return "ไม่ทราบเวลา";
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: "Asia/Bangkok",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

function formatPace(activity: StravaActivity): string {
  if (activity.distanceKm <= 0) return "—";
  const totalSeconds = Math.round(activity.movingTimeSeconds / activity.distanceKm);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")} นาที/กม.`;
}

function formatLapPace(distanceKm: number, movingTimeSeconds: number): string {
  if (distanceKm <= 0) return "—";
  const totalSeconds = Math.round(movingTimeSeconds / distanceKm);
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(
    2,
    "0"
  )} /กม.`;
}

function formatDate(dateString: string): string {
  const date = new Date(`${dateString}T00:00:00Z`);
  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(date);
}

export default function AthleteActivitiesPage() {
  const { id } = useParams<{ id: string }>();
  const [athlete, setAthlete] = useState<Athlete | null>(null);
  const [program, setProgram] = useState<ProgramConfig | null>(null);
  const [weekStart, setWeekStart] = useState(FIRST_WEEK_START);
  const [activities, setActivities] = useState<StravaActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [signedInAthleteId, setSignedInAthleteId] = useState<string | null>(null);
  const [isSavingManual, setIsSavingManual] = useState(false);
  const [manualError, setManualError] = useState("");
  const [manualName, setManualName] = useState("");
  const [manualDistance, setManualDistance] = useState("");
  const [manualMinutes, setManualMinutes] = useState("");
  const [manualHeartrate, setManualHeartrate] = useState("");
  const [manualStart, setManualStart] = useState("");
  const [reloadVersion, setReloadVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const requestedWeek =
      new URLSearchParams(window.location.search).get("weekStart") ||
      FIRST_WEEK_START;
    setWeekStart(requestedWeek);

    async function loadWeek() {
      try {
        const [athletesResponse, sessionResponse, programResponse, activityResponse] =
          await Promise.all([
            fetch("/api/athletes", { signal: controller.signal }),
            fetch("/api/athletes/session", {
              signal: controller.signal,
              cache: "no-store",
            }),
            fetch(`/api/program?weekStart=${encodeURIComponent(requestedWeek)}`, {
              signal: controller.signal,
            }),
            fetch(
              `/api/strava/activities?weekStart=${encodeURIComponent(requestedWeek)}&athleteId=${encodeURIComponent(id)}`,
              { signal: controller.signal, cache: "no-store" }
            ),
          ]);
        const [athletesData, sessionData, programData, activityData] =
          await Promise.all([
            athletesResponse.json(),
            sessionResponse.json(),
            programResponse.json(),
            activityResponse.json() as Promise<ActivityResponse>,
          ]);

        if (
          !athletesResponse.ok ||
          !sessionResponse.ok ||
          !programResponse.ok
        ) {
          throw new Error("ไม่สามารถโหลดข้อมูลนักกีฬาและโปรแกรมสัปดาห์นี้ได้");
        }

        const selectedAthlete = (athletesData as Athlete[]).find(
          (item) => item.id === id
        );
        if (!selectedAthlete) throw new Error("ไม่พบนักกีฬา");
        if (!activityResponse.ok) {
          throw new Error(activityData.message || "ไม่สามารถโหลดกิจกรรมได้");
        }
        if (!activityData.authenticated) {
          throw new Error("Sign in to view athlete activities.");
        }

        setAthlete(selectedAthlete);
        setSignedInAthleteId(
          sessionData.authenticated ? sessionData.athleteId : null
        );
        setProgram(programData as ProgramConfig);
        setActivities(activityData.activities);
        if (!manualStart) setManualStart(`${requestedWeek}T07:00`);
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "เกิดข้อผิดพลาดขณะโหลดกิจกรรม"
          );
        }
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }

    void loadWeek();
    return () => controller.abort();
  }, [id, reloadVersion]);

  const handleManualSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setManualError("");
    setIsSavingManual(true);
    try {
      const response = await fetch("/api/athletes/me/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weekStart,
          name: manualName,
          distanceKm: Number(manualDistance),
          movingTimeSeconds: Math.round(Number(manualMinutes) * 60),
          startDateLocal: manualStart,
          averageHeartrate: manualHeartrate
            ? Number(manualHeartrate)
            : undefined,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "บันทึกกิจกรรมไม่สำเร็จ");
      }
      setManualName("");
      setManualDistance("");
      setManualMinutes("");
      setManualHeartrate("");
      setReloadVersion((version) => version + 1);
    } catch (saveError) {
      setManualError(
        saveError instanceof Error ? saveError.message : "บันทึกกิจกรรมไม่สำเร็จ"
      );
    } finally {
      setIsSavingManual(false);
    }
  };

  const activitiesByDay = activities.reduce<Record<string, StravaActivity[]>>(
    (grouped, activity) => {
      const date = getLocalDate(activity);
      if (date) grouped[date] = [...(grouped[date] || []), activity];
      return grouped;
    },
    {}
  );
  const totalDistance = activities.reduce(
    (total, activity) => total + activity.distanceKm,
    0
  );
  const totalMovingTime = activities.reduce(
    (total, activity) => total + activity.movingTimeSeconds,
    0
  );
  const weekStartTime = new Date(`${weekStart}T00:00:00Z`).getTime();
  const programTrainingDays =
    program?.schedule.filter((day) => !day.isRest).length || 0;
  const trainingDays = Object.keys(activitiesByDay).filter((date) => {
    const dayIndex = Math.floor(
      (new Date(`${date}T00:00:00Z`).getTime() - weekStartTime) /
        (24 * 60 * 60 * 1000)
    );
    return dayIndex >= 0 && program?.schedule[dayIndex] && !program.schedule[dayIndex].isRest;
  }).length;
  const averagePace =
    totalDistance > 0 ? formatPace({
      id: 0,
      name: "",
      distanceKm: totalDistance,
      movingTimeSeconds: totalMovingTime,
      startDate: "",
    }) : "—";

  return (
    <main className="min-h-screen bg-[#0e1317] px-4 py-6 text-gray-100 sm:px-6 md:py-10">
      <div className="mx-auto max-w-3xl">
        <a
          href={`/?weekStart=${encodeURIComponent(weekStart)}`}
          className="mb-6 inline-flex items-center gap-2 text-sm text-gray-400 transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          กลับหน้าหลัก
        </a>

        <section className="overflow-hidden rounded-2xl border border-kmutt-border bg-kmutt-card shadow-2xl">
          <header className="flex items-center gap-4 border-b border-kmutt-border px-5 py-5 sm:px-7">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-kmutt-orange/15 text-kmutt-orange">
              <Activity className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs text-gray-400">
                {program?.weekTitle || "สรุปกิจกรรมประจำสัปดาห์"}
              </p>
              <h1 className="mt-1 text-2xl font-bold text-white">
                {athlete?.nickname || "กิจกรรมนักกีฬา"}
              </h1>
              {athlete?.stravaName && (
                <p className="mt-1 text-sm text-gray-400">
                  Strava: {athlete.stravaName}
                </p>
              )}
            </div>
          </header>

          <div className="space-y-6 p-5 sm:p-7">
            {isLoading ? (
              <p className="py-8 text-center text-sm text-gray-400">
                กำลังโหลดกิจกรรม...
              </p>
            ) : error ? (
              <div
                role="alert"
                className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300"
              >
                {error}
                {error.includes("Sign in") && (
                  <a
                    href="/api/strava/auth?flow=athlete"
                    className="ml-1 font-semibold underline hover:text-white"
                  >
                    เชื่อมต่อที่นี่
                  </a>
                )}
              </div>
            ) : (
              <>
                <section aria-label="สรุปกิจกรรมประจำสัปดาห์">
                  <h2 className="mb-3 text-sm font-bold text-white">
                    สรุปสัปดาห์นี้
                  </h2>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <SummaryCard label="ระยะรวม" value={`${totalDistance.toFixed(1)} กม.`} />
                    <SummaryCard
                      label="วันซ้อม"
                      value={`${trainingDays}/${programTrainingDays} วัน`}
                    />
                    <SummaryCard label="กิจกรรม" value={`${activities.length} ครั้ง`} />
                    <SummaryCard label="เพซเฉลี่ย" value={averagePace} />
                  </div>
                </section>

                {signedInAthleteId === id && (
                  <section
                    aria-label="เพิ่มกิจกรรมด้วยตนเอง"
                    className="rounded-xl border border-kmutt-border bg-black/20 p-4"
                  >
                    <h2 className="mb-3 text-sm font-bold text-white">
                      เพิ่มกิจกรรมด้วยตนเอง
                    </h2>
                    <form onSubmit={handleManualSubmit} className="grid gap-3 sm:grid-cols-2">
                      <label className="text-xs text-gray-400">
                        ชื่อกิจกรรม
                        <input
                          required
                          maxLength={120}
                          value={manualName}
                          onChange={(event) => setManualName(event.target.value)}
                          className="mt-1 w-full rounded-lg border border-kmutt-border bg-[#111619] px-3 py-2 text-sm text-white"
                        />
                      </label>
                      <label className="text-xs text-gray-400">
                        วันที่และเวลา (เวลาไทย)
                        <input
                          type="datetime-local"
                          required
                          value={manualStart}
                          onChange={(event) => setManualStart(event.target.value)}
                          className="mt-1 w-full rounded-lg border border-kmutt-border bg-[#111619] px-3 py-2 text-sm text-white"
                        />
                      </label>
                      <label className="text-xs text-gray-400">
                        ระยะทาง (กม.)
                        <input
                          type="number"
                          required
                          min="0.01"
                          max="300"
                          step="0.01"
                          value={manualDistance}
                          onChange={(event) => setManualDistance(event.target.value)}
                          className="mt-1 w-full rounded-lg border border-kmutt-border bg-[#111619] px-3 py-2 text-sm text-white"
                        />
                      </label>
                      <label className="text-xs text-gray-400">
                        เวลาวิ่ง (นาที)
                        <input
                          type="number"
                          required
                          min="1"
                          max="1440"
                          step="1"
                          value={manualMinutes}
                          onChange={(event) => setManualMinutes(event.target.value)}
                          className="mt-1 w-full rounded-lg border border-kmutt-border bg-[#111619] px-3 py-2 text-sm text-white"
                        />
                      </label>
                      <label className="text-xs text-gray-400">
                        หัวใจเฉลี่ย (ไม่บังคับ)
                        <input
                          type="number"
                          min="30"
                          max="250"
                          value={manualHeartrate}
                          onChange={(event) => setManualHeartrate(event.target.value)}
                          className="mt-1 w-full rounded-lg border border-kmutt-border bg-[#111619] px-3 py-2 text-sm text-white"
                        />
                      </label>
                      {manualError && (
                        <p role="alert" className="self-end text-sm text-red-300">
                          {manualError}
                        </p>
                      )}
                      <button
                        type="submit"
                        disabled={isSavingManual}
                        className="rounded-lg bg-kmutt-orange px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60 sm:col-span-2"
                      >
                        {isSavingManual ? "กำลังบันทึก..." : "บันทึกกิจกรรมในเว็บไซต์"}
                      </button>
                    </form>
                  </section>
                )}

                <section aria-label="กิจกรรมแยกตามวัน">
                  <h2 className="mb-3 text-sm font-bold text-white">
                    กิจกรรมรายวัน
                  </h2>
                  <div className="space-y-3">
                    {Array.from({ length: 7 }, (_, dayIndex) => {
                      const date = new Date(`${weekStart}T00:00:00Z`);
                      date.setUTCDate(date.getUTCDate() + dayIndex);
                      const dateKey = date.toISOString().slice(0, 10);
                      const dayActivities = activitiesByDay[dateKey] || [];
                      const schedule = program?.schedule[dayIndex];
                      const workoutType = schedule ? getWorkoutType(schedule) : "easy";
                      const workoutStyle = workoutStyles[workoutType];
                      const scheduledInterval = workoutType === "interval";

                      return (
                        <article
                          key={dateKey}
                          className={`rounded-xl border p-4 ${workoutStyle.card}`}
                        >
                          <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <h3 className="font-semibold text-white">
                                {WEEKDAY_NAMES[dayIndex]} · {formatDate(dateKey)}
                              </h3>
                              {schedule && (
                                <p className={`mt-0.5 text-xs ${workoutStyle.accent}`}>
                                  โปรแกรม: {schedule.title}
                                  {schedule.isRest ? " · วันพัก" : ""}
                                </p>
                              )}
                            </div>
                            {schedule && !schedule.isRest && (
                              <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${workoutStyle.badge}`}>
                              {workoutType === "long"
                                ? "Long run"
                                : workoutType[0].toUpperCase() + workoutType.slice(1)}
                            </span>
                            )}
                          </header>

                          {dayActivities.length === 0 ? (
                            <p className="text-sm text-gray-500">ไม่มีข้อมูลกิจกรรม</p>
                          ) : (
                            <ul className="space-y-3">
                              {dayActivities.map((activity) => (
                                <React.Fragment key={activity.id}>
                                <li
                                  className="flex items-start justify-between gap-3 border-t border-kmutt-border/70 pt-3 first:border-t-0 first:pt-0"
                                >
                                  <div className="grid min-w-0 flex-1 grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-4">
                                    <ActivityMetric
                                      label="เวลา"
                                      value={formatLocalTime(activity)}
                                    />
                                    <ActivityMetric
                                      label="ระยะ"
                                      value={`${activity.distanceKm.toFixed(2)} กม.`}
                                    />
                                    <ActivityMetric
                                      label="เวลาวิ่ง"
                                      value={formatDuration(activity.movingTimeSeconds)}
                                    />
                                    <ActivityMetric
                                      label="เพซ"
                                      value={formatPace(activity)}
                                    />
                                    <ActivityMetric
                                      label="หัวใจเฉลี่ย"
                                      value={
                                        typeof activity.averageHeartrate === "number"
                                          ? `${Math.round(activity.averageHeartrate)} bpm`
                                          : "ไม่มีข้อมูล"
                                      }
                                    />
                                    {scheduledInterval && (
                                      <ActivityMetric label="กิจกรรม" value={activity.name} />
                                    )}
                                  </div>
                                  {activity.source === "manual" ? (
                                    <span className="shrink-0 rounded-full bg-white/10 px-2 py-1 text-[10px] text-gray-300">
                                      บันทึกเอง
                                    </span>
                                  ) : (
                                    <a
                                      href={`https://www.strava.com/activities/${activity.id}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      aria-label={`เปิด ${activity.name} บน Strava ในแท็บใหม่`}
                                      className="shrink-0 rounded-lg p-2 text-kmutt-orange transition hover:bg-kmutt-orange/10"
                                    >
                                      <ExternalLink className="h-4 w-4" />
                                    </a>
                                  )}
                                </li>
                                {scheduledInterval && activity.source !== "manual" && (
                                  <li className="ml-3 border-l-2 border-red-500/40 pl-4">
                                    <details className="group">
                                      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-2 py-2 text-sm font-semibold text-red-300 transition hover:bg-red-500/10 [&::-webkit-details-marker]:hidden">
                                        <span>รอบวิ่ง · {activity.laps?.length || 0} รอบ</span>
                                        <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" />
                                      </summary>
                                      {activity.laps && activity.laps.length > 0 ? (
                                        <div className="mt-2 overflow-x-auto">
                                          <table className="w-full min-w-[440px] text-left text-xs">
                                          <thead className="text-gray-500">
                                            <tr>
                                              <th className="pb-2 pr-3">รอบ</th>
                                              <th className="pb-2 pr-3">ระยะ</th>
                                              <th className="pb-2 pr-3">เวลา</th>
                                              <th className="pb-2 pr-3">เพซ</th>
                                              <th className="pb-2">หัวใจเฉลี่ย</th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-kmutt-border/60 text-gray-300">
                                            {activity.laps.map((lap, lapIndex) => (
                                              <tr key={lap.id ?? `${activity.id}-${lapIndex}`}>
                                                <td className="py-2 pr-3">{lap.lapIndex}</td>
                                                <td className="py-2 pr-3">
                                                  {lap.distanceKm.toFixed(2)} กม.
                                                </td>
                                                <td className="py-2 pr-3">
                                                  {formatDuration(lap.movingTimeSeconds)}
                                                </td>
                                                <td className="py-2 pr-3">
                                                  {formatLapPace(
                                                    lap.distanceKm,
                                                    lap.movingTimeSeconds
                                                  )}
                                                </td>
                                                <td className="py-2">
                                                  {typeof lap.averageHeartrate === "number"
                                                    ? `${Math.round(lap.averageHeartrate)} bpm`
                                                    : "—"}
                                                </td>
                                              </tr>
                                            ))}
                                          </tbody>
                                          </table>
                                        </div>
                                      ) : (
                                        <p className="px-2 py-2 text-xs text-gray-500">
                                          Strava ไม่มีข้อมูลรอบวิ่งสำหรับกิจกรรมนี้
                                        </p>
                                      )}
                                    </details>
                                  </li>
                                )}
                                </React.Fragment>
                              ))}
                            </ul>
                          )}
                        </article>
                      );
                    })}
                  </div>
                </section>
              </>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-kmutt-border bg-black/20 p-4">
      <p className="text-xs text-gray-400">{label}</p>
      <p className="mt-1 text-lg font-bold text-white">{value}</p>
    </div>
  );
}

function ActivityMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] text-gray-500">{label}</p>
      <p className="truncate text-sm font-medium text-gray-200">{value}</p>
    </div>
  );
}
