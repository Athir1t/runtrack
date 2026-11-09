"use client";

import React, { useCallback, useEffect, useState } from "react";
import defaultProgram from "@/data/program.json";
import defaultAthletes from "@/data/athletes.json";
import { ProgramConfig, Athlete, StravaActivity } from "@/types";
import { evaluateAthletes } from "@/utils/calculations";
import { Header } from "@/components/Header";
import { WeeklyProgram } from "@/components/WeeklyProgram";
import { LeaderboardTable } from "@/components/LeaderboardTable";
import { EditModal } from "@/components/EditModal";
import { AdminLoginModal } from "@/components/AdminLoginModal";

const FIRST_WEEK_START = defaultProgram.weekStartDate;

interface WeeklyActivitiesResponse {
  connected: boolean;
  athleteName?: string;
  activities: StravaActivity[];
  athleteSummaries?: Array<{
    athleteId: string;
    distanceKm: number;
    runsCount: number;
    activityDates: string[];
  }>;
  message?: string;
  needsSync?: boolean;
}

function shiftWeek(weekStart: string, weeks: number): string {
  const date = new Date(`${weekStart}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + weeks * 7);
  return date.toISOString().slice(0, 10);
}

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[.…]+/g, "").trim();
}

function findConnectedAthlete(athletes: Athlete[], name: string): Athlete | undefined {
  const normalizedName = normalizeName(name);
  return athletes.find((athlete) => {
    const athleteName = normalizeName(athlete.stravaName);
    return (
      athleteName === normalizedName ||
      (/[.…]+$/.test(athlete.stravaName.trim()) &&
        normalizedName.startsWith(athleteName))
    );
  });
}

function getUnsyncedRoster(athletes: Athlete[]): Athlete[] {
  return athletes
    .filter((athlete) => athlete.inClub)
    .map((athlete) => ({
      ...athlete,
      distanceKm: 0,
      runsCount: 0,
      trainingDays: 0,
      isSynced: false,
    }));
}

function getTrainingWeekday(startDate: string, weekStart: string): number | null {
  const activityDate = new Date(startDate);
  if (Number.isNaN(activityDate.getTime())) return null;

  const dateParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(activityDate);
  const part = (type: string) => dateParts.find((item) => item.type === type)?.value;
  const localDate = `${part("year")}-${part("month")}-${part("day")}`;
  const activityDay = new Date(`${localDate}T00:00:00Z`).getTime();
  const weekDay = new Date(`${weekStart}T00:00:00Z`).getTime();
  const dayIndex = Math.floor((activityDay - weekDay) / (24 * 60 * 60 * 1000));

  return dayIndex >= 0 && dayIndex < 7 ? dayIndex : null;
}

export default function Home() {
  const [program, setProgram] = useState<ProgramConfig>(defaultProgram as ProgramConfig);
  const [roster, setRoster] = useState<Athlete[]>(defaultAthletes as Athlete[]);
  const [athletes, setAthletes] = useState<Athlete[]>(
    getUnsyncedRoster(defaultAthletes as Athlete[])
  );
  const [weekStartDate, setWeekStartDate] = useState(FIRST_WEEK_START);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isStravaConnected, setIsStravaConnected] = useState<boolean | null>(null);
  const [stravaStatus, setStravaStatus] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);

  const {
    rankedAthletes,
    totalTeamKm,
    completedCount,
    totalAthletesCount,
  } = evaluateAthletes(athletes, program);

  const loadWeekData = useCallback(async (
    showStatus = false,
    forceRefresh = false
  ) => {
    try {
      const [programResponse, athletesResponse, activitiesResponse] =
        await Promise.all([
          fetch(`/api/program?weekStart=${encodeURIComponent(weekStartDate)}`),
          fetch("/api/athletes"),
          fetch(
            `/api/strava/activities?weekStart=${encodeURIComponent(weekStartDate)}${
              forceRefresh ? "&refresh=1" : ""
            }`,
            { cache: "no-store" }
          ),
        ]);

      if (!programResponse.ok || !athletesResponse.ok) {
        throw new Error("ไม่สามารถโหลดข้อมูลสัปดาห์นี้ได้");
      }

      const [weekProgram, savedAthletes, activityData] = await Promise.all([
        programResponse.json() as Promise<ProgramConfig>,
        athletesResponse.json() as Promise<Athlete[]>,
        activitiesResponse.json() as Promise<WeeklyActivitiesResponse>,
      ]);
      setProgram(weekProgram);
      setRoster(savedAthletes);

      if (!activitiesResponse.ok) {
        setIsStravaConnected(false);
        setAthletes(getUnsyncedRoster(savedAthletes));
        setStravaStatus(
          showStatus
            ? activityData.message || "ไม่สามารถโหลดกิจกรรมจาก Strava ได้"
            : ""
        );
        return;
      }

      setIsStravaConnected(activityData.connected);
      const summaries = new Map(
        (activityData.athleteSummaries || []).map((summary) => [
          summary.athleteId,
          summary,
        ])
      );
      setAthletes(
        savedAthletes
          .filter((item) => item.inClub)
          .map((item) => {
            const summary = summaries.get(item.id);
            const trainingDays = new Set(
              (summary?.activityDates || [])
                .map((date) => getTrainingWeekday(`${date}T12:00:00`, weekStartDate))
                .filter(
                  (day): day is number =>
                    day !== null &&
                    program.schedule[day] !== undefined &&
                    !program.schedule[day].isRest
                )
            ).size;
            return {
              ...item,
              distanceKm: Number((summary?.distanceKm || 0).toFixed(1)),
              runsCount: summary?.runsCount || 0,
              trainingDays,
              isSynced: Boolean(summary),
            };
          })
      );
      setStravaStatus(
        showStatus
          ? forceRefresh
            ? `ซิงค์กิจกรรม ${activityData.activities.length} รายการและบันทึกใน PostgreSQL แล้ว`
            : "โหลดข้อมูลการซ้อมประจำสัปดาห์แล้ว"
          : ""
      );
    } catch (error) {
      console.error("Error loading weekly data:", error);
      setIsStravaConnected(false);
      setAthletes(getUnsyncedRoster(roster));
      setStravaStatus(
        showStatus ? "เกิดข้อผิดพลาดขณะโหลดข้อมูลสัปดาห์นี้" : ""
      );
    }
  }, [weekStartDate]);

  useEffect(() => {
    setAthletes(getUnsyncedRoster(defaultAthletes as Athlete[]));
    void loadWeekData();
  }, [loadWeekData]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get("strava_error");
    const athleteConnected = params.get("athlete") === "connected";
    if (params.get("admin") === "login") setIsLoginOpen(true);
    if (error) {
      setStravaStatus(`เชื่อมต่อ Strava ไม่สำเร็จ: ${error}`);
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (athleteConnected) {
      setStravaStatus("เชื่อมต่อ Strava สำเร็จแล้ว");
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (params.has("admin")) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const [athleteSession, setAthleteSession] = useState<{
    athleteId: string;
    athleteName: string;
  } | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch("/api/admin/session", { cache: "no-store" }),
      fetch("/api/athletes/session", { cache: "no-store" }),
    ])
      .then(async (response) => {
        if (response.some((item) => !item.ok)) {
          throw new Error("Unable to check login session");
        }
        return Promise.all(response.map((item) => item.json()));
      })
      .then(([admin, athlete]) => {
        if (active) {
          setIsAdmin(admin.authenticated);
          setAthleteSession(
            athlete.authenticated
              ? { athleteId: athlete.athleteId, athleteName: athlete.athleteName }
              : null
          );
          setIsStravaConnected(Boolean(athlete.authenticated));
          void loadWeekData();
        }
      })
      .catch((error) => console.error("Error checking admin session:", error));
    return () => {
      active = false;
    };
  }, [loadWeekData]);

  const handleAdminAction = async () => {
    if (!isAdmin) {
      setIsLoginOpen(true);
      return;
    }
    const response = await fetch("/api/admin/logout", { method: "POST" });
    if (!response.ok) {
      setStravaStatus("ออกจากระบบไม่สำเร็จ");
      return;
    }
    setIsAdmin(false);
    setAthleteSession(null);
    setIsStravaConnected(false);
    setIsSettingsOpen(false);
    setStravaStatus("ออกจากระบบผู้ดูแลแล้ว");
  };

  const handleAthleteAction = async () => {
    if (!athleteSession) {
      window.location.assign("/api/strava/auth?flow=athlete");
      return;
    }
    const response = await fetch("/api/admin/logout", { method: "POST" });
    if (!response.ok) {
      setStravaStatus("ออกจากระบบไม่สำเร็จ");
      return;
    }
    setAthleteSession(null);
    setIsAdmin(false);
    setIsStravaConnected(false);
    setIsSettingsOpen(false);
    void loadWeekData();
    setStravaStatus("ออกจากระบบแล้ว");
  };

  const handleSyncStrava = async () => {
    if (!athleteSession) {
      window.location.assign("/api/strava/auth?flow=athlete");
      return;
    }
    if (isStravaConnected === null) return;

    setIsSyncing(true);
    try {
      await loadWeekData(true, true);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSaveData = async (
    newProgram: ProgramConfig,
    newAthletes: Athlete[]
  ) => {
    const [programResponse, athletesResponse] = await Promise.all([
      fetch(`/api/program?weekStart=${encodeURIComponent(weekStartDate)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newProgram),
      }),
      fetch("/api/athletes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newAthletes),
      }),
    ]);

    if (!programResponse.ok || !athletesResponse.ok) {
      throw new Error("ไม่สามารถบันทึกข้อมูลได้");
    }

    setProgram(newProgram);
    setRoster(newAthletes);
    const currentById = new Map(athletes.map((athlete) => [athlete.id, athlete]));
    setAthletes(
      newAthletes
        .filter((athlete) => athlete.inClub)
        .map((athlete) => {
          const current = currentById.get(athlete.id);
          return current?.isSynced
            ? {
                ...athlete,
                distanceKm: current.distanceKm,
                runsCount: current.runsCount,
                trainingDays: current.trainingDays,
                isSynced: true,
              }
            : {
                ...athlete,
                distanceKm: 0,
                runsCount: 0,
                trainingDays: 0,
                isSynced: false,
              };
        })
    );
  };

  return (
    <main className="min-h-screen bg-[#0e1317] text-gray-100 p-4 sm:p-6 md:p-8 max-w-5xl mx-auto">
      <Header
        weekTitle={program.weekTitle}
        canGoToPreviousWeek={weekStartDate !== FIRST_WEEK_START}
        completedCount={completedCount}
        totalAthletesCount={totalAthletesCount}
        totalTeamKm={totalTeamKm}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onPreviousWeek={() => {
          setStravaStatus("");
          setWeekStartDate((current) => shiftWeek(current, -1));
        }}
        onNextWeek={() => {
          setStravaStatus("");
          setWeekStartDate((current) => shiftWeek(current, 1));
        }}
        onSyncStrava={handleSyncStrava}
        isAdmin={isAdmin}
        onAdminAction={() => void handleAdminAction()}
        athleteName={athleteSession?.athleteName || null}
        onAthleteAction={() => void handleAthleteAction()}
        isSyncing={isSyncing}
        stravaStatus={stravaStatus}
      />

      <WeeklyProgram program={program} />

      <LeaderboardTable
        rankedAthletes={rankedAthletes}
        weekStartDate={weekStartDate}
      />

      <EditModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        program={program}
        athletes={roster}
        onSave={handleSaveData}
      />

      {isLoginOpen && (
        <AdminLoginModal
          onClose={() => setIsLoginOpen(false)}
          onLogin={() => {
            setIsAdmin(true);
            setIsLoginOpen(false);
            setStravaStatus("เข้าสู่ระบบผู้ดูแลแล้ว");
          }}
        />
      )}
    </main>
  );
}
