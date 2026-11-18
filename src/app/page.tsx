"use client";

import React, { useCallback, useEffect, useState } from "react";
import defaultProgram from "@/data/program.json";
import { ProgramConfig, Athlete, StravaActivity } from "@/types";
import { evaluateAthletes } from "@/utils/calculations";
import {
  getCreditedTrainingDayCount,
  withDerivedProgramTargets,
} from "@/utils/program";
import { Header } from "@/components/Header";
import {
  ConnectWithStravaButton,
  PoweredByStravaLogo,
} from "@/components/StravaBrand";
import { WeeklyProgram } from "@/components/WeeklyProgram";
import { LeaderboardTable } from "@/components/LeaderboardTable";
import { EditModal } from "@/components/EditModal";
import { AdminLoginModal } from "@/components/AdminLoginModal";

const FIRST_WEEK_START = defaultProgram.weekStartDate;

interface WeeklyActivitiesResponse {
  authenticated: boolean;
  isAdmin?: boolean;
  athleteId?: string;
  sessionAthleteName?: string;
  connected: boolean;
  athleteName?: string;
  program: ProgramConfig;
  athletes: Athlete[];
  activities: StravaActivity[];
  athleteSummaries?: Array<{
    athleteId: string;
    distanceKm: number;
    runsCount: number;
    activityDates: string[];
    validActivityDates: string[];
  }>;
  message?: string;
  needsSync?: boolean;
}

interface BulkStravaSyncResponse {
  error?: string;
  connectedAthletes: number;
  synced: number;
  results: Array<{ success: boolean; athleteName: string }>;
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
  const [roster, setRoster] = useState<Athlete[]>([]);
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [weekStartDate, setWeekStartDate] = useState(FIRST_WEEK_START);
  const [isWeekDataLoading, setIsWeekDataLoading] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isStravaConnected, setIsStravaConnected] = useState<boolean | null>(null);
  const [stravaStatus, setStravaStatus] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [athleteSession, setAthleteSession] = useState<{
    athleteId: string;
    athleteName: string;
  } | null>(null);

  const {
    rankedAthletes,
    totalTeamKm,
    completedCount,
    totalAthletesCount: syncedCount,
  } = evaluateAthletes(athletes, program);
  const allClubAthletesCount = roster.filter((athlete) => athlete.inClub).length;
  const isAuthenticated = Boolean(athleteSession || isAdmin);

  const loadWeekData = useCallback(async (
    showStatus = false,
    forceRefresh = false
  ) => {
    if (!forceRefresh) setIsWeekDataLoading(true);
    try {
      const activitiesResponse = await fetch(
        `/api/strava/activities?weekStart=${encodeURIComponent(weekStartDate)}${
          forceRefresh ? "&refresh=1" : ""
        }`,
        { cache: "no-store" }
      );
      const activityData =
        (await activitiesResponse.json()) as WeeklyActivitiesResponse;
      if (!activitiesResponse.ok) {
        throw new Error(activityData.message || "ไม่สามารถโหลดข้อมูลสัปดาห์นี้ได้");
      }

      const weekProgram = activityData.program;
      setProgram(weekProgram);
      setIsAdmin(activityData.isAdmin === true);
      setAthleteSession(
        activityData.athleteId && activityData.sessionAthleteName
          ? {
              athleteId: activityData.athleteId,
              athleteName: activityData.sessionAthleteName,
            }
          : null
      );
      setRoster(activityData.athletes);
      setIsStravaConnected(activityData.connected === true);
      if (!activityData.authenticated) {
        setAthletes([]);
        setStravaStatus("");
        return;
      }

      const summaries = new Map(
        (activityData.athleteSummaries || []).map((summary) => [
          summary.athleteId,
          summary,
        ])
      );
      setAthletes(
        activityData.athletes
          .filter((item) => item.inClub)
          .map((item) => {
            const summary = summaries.get(item.id);
            const trainingDayIndexes = Array.from(new Set(
              (summary?.validActivityDates || [])
                .map((date) => getTrainingWeekday(`${date}T12:00:00`, weekStartDate))
                .filter(
                  (day): day is number =>
                    day !== null &&
                    weekProgram.schedule[day] !== undefined
                )
            ));
            return {
              ...item,
              distanceKm: Number((summary?.distanceKm || 0).toFixed(1)),
              runsCount: summary?.runsCount || 0,
              trainingDays: getCreditedTrainingDayCount(
                weekProgram.schedule,
                trainingDayIndexes
              ),
              trainingDayIndexes,
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
      setIsAdmin(false);
      setAthleteSession(null);
      setIsStravaConnected(false);
      setRoster([]);
      setAthletes([]);
      setStravaStatus(
        showStatus ? "เกิดข้อผิดพลาดขณะโหลดข้อมูลสัปดาห์นี้" : ""
      );
    } finally {
      if (!forceRefresh) setIsWeekDataLoading(false);
    }
  }, [weekStartDate]);

  useEffect(() => {
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
    setAthletes([]);
    void loadWeekData();
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
    setAthletes([]);
    void loadWeekData();
    setStravaStatus("ออกจากระบบแล้ว");
  };

  const handleDisconnectStrava = async () => {
    if (
      !window.confirm(
        "ยกเลิกการเชื่อมต่อ Strava และลบข้อมูลกิจกรรม Strava ที่บันทึกไว้หรือไม่?"
      )
    ) {
      return;
    }

    try {
      const response = await fetch("/api/strava/disconnect", {
        method: "POST",
      });
      const result = (await response.json()) as {
        error?: string;
        warning?: string;
      };
      if (!response.ok) {
        throw new Error(result.error || "ยกเลิกการเชื่อมต่อ Strava ไม่สำเร็จ");
      }

      setAthleteSession(null);
      setIsStravaConnected(false);
      setAthletes([]);
      setIsSettingsOpen(false);
      void loadWeekData();
      setStravaStatus(
        result.warning
          ? `ยกเลิกการเชื่อมต่อแล้ว แต่ ${result.warning}`
          : "ยกเลิกการเชื่อมต่อ Strava และลบข้อมูลที่บันทึกไว้แล้ว"
      );
    } catch (error) {
      setStravaStatus(
        error instanceof Error
          ? error.message
          : "ยกเลิกการเชื่อมต่อ Strava ไม่สำเร็จ"
      );
    }
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

  const handleSyncAll = async () => {
    setIsSyncing(true);
    try {
      const response = await fetch("/api/strava/sync-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekStart: weekStartDate }),
      });
      const result: BulkStravaSyncResponse = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "ไม่สามารถซิงค์ข้อมูลทั้งหมดได้");
      }

      await loadWeekData();
      if (result.connectedAthletes === 0) {
        setStravaStatus("ยังไม่มีบัญชี Strava ที่เชื่อมต่อ");
      } else {
        const failedAthletes = result.results
          .filter((item) => !item.success)
          .map((item) => item.athleteName);
        setStravaStatus(
          `ซิงค์สำเร็จ ${result.synced}/${result.connectedAthletes} บัญชี` +
            (failedAthletes.length ? ` · ไม่สำเร็จ: ${failedAthletes.join(", ")}` : "")
        );
      }
    } catch (error) {
      console.error("Error syncing all Strava accounts:", error);
      setStravaStatus(
        error instanceof Error ? error.message : "ไม่สามารถซิงค์ข้อมูลทั้งหมดได้"
      );
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

    setProgram(withDerivedProgramTargets(newProgram));
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
                trainingDayIndexes: current.trainingDayIndexes,
                isSynced: true,
              }
            : {
                ...athlete,
                distanceKm: 0,
                runsCount: 0,
                trainingDays: 0,
                trainingDayIndexes: [],
                isSynced: false,
              };
        })
    );
  };

  return (
    <main className="min-h-screen bg-kmutt-dark text-gray-100 p-4 sm:p-6 md:p-8 max-w-5xl mx-auto">
      <Header
        weekTitle={program.weekTitle}
        canGoToPreviousWeek={weekStartDate !== FIRST_WEEK_START}
        isAuthenticated={isAuthenticated}
        completedCount={completedCount}
        allClubAthletesCount={allClubAthletesCount}
        syncedCount={syncedCount}
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
        onSyncAll={handleSyncAll}
        isAdmin={isAdmin}
        onAdminAction={() => void handleAdminAction()}
        athleteName={athleteSession?.athleteName || null}
        onAthleteAction={() => void handleAthleteAction()}
        onDisconnectStrava={handleDisconnectStrava}
        isSyncing={isSyncing}
        stravaStatus={stravaStatus}
      />

      <WeeklyProgram program={program} />

      {isWeekDataLoading ? (
        <section
          aria-busy="true"
          className="rounded-2xl border border-kmutt-border bg-kmutt-card px-5 py-10 text-center text-sm text-gray-400"
        >
          กำลังตรวจสอบการเข้าสู่ระบบ...
        </section>
      ) : isAuthenticated ? (
        <LeaderboardTable
          rankedAthletes={rankedAthletes}
          weekStartDate={weekStartDate}
          schedule={program.schedule}
          program={program}
          isLoading={false}
        />
      ) : (
        <section className="rounded-2xl border border-kmutt-border bg-kmutt-card p-6 shadow-2xl sm:p-8">
          <div className="mx-auto max-w-xl text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-kmutt-orange/30 bg-kmutt-orange/10 text-2xl font-black text-kmutt-orange">
              K
            </div>
            <h2 className="mt-4 text-xl font-bold text-white sm:text-2xl">
              ระบบบันทึกการฝึกซ้อม KMUTT Athletics
            </h2>
            <p className="mt-3 text-sm leading-6 text-gray-400">
              เพื่อความปลอดภัยและความเป็นส่วนตัวตามนโยบาย Strava API
              กรุณาเชื่อมต่อบัญชี Strava ของคุณเพื่อดูตารางสรุปการซ้อมของทีม
            </p>
            <div className="mt-6 flex justify-center">
              <ConnectWithStravaButton />
            </div>
            <div className="mt-3">
              <button
                type="button"
                onClick={() => setIsLoginOpen(true)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-gray-300 transition hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kmutt-orange"
              >
                เข้าสู่ระบบสำหรับโค้ช / ผู้ดูแล (Admin Login)
              </button>
            </div>
            <PoweredByStravaLogo className="mt-6" />
          </div>
        </section>
      )}

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
            void loadWeekData();
          }}
        />
      )}
    </main>
  );
}
