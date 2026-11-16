"use client";

import React from "react";
import {
  ChevronLeft,
  ChevronRight,
  LogIn,
  LogOut,
  RefreshCw,
  Settings,
} from "lucide-react";
import {
  ConnectWithStravaButton,
  StravaIcon,
} from "@/components/StravaBrand";
import { ThemeToggle } from "@/components/ThemeToggle";

interface HeaderProps {
  weekTitle: string;
  canGoToPreviousWeek: boolean;
  isAuthenticated: boolean;
  completedCount: number;
  allClubAthletesCount: number;
  syncedCount: number;
  totalTeamKm: number;
  onOpenSettings: () => void;
  onPreviousWeek: () => void;
  onNextWeek: () => void;
  onSyncStrava: () => Promise<void>;
  onSyncAll: () => Promise<void>;
  isAdmin: boolean;
  onAdminAction: () => void;
  athleteName: string | null;
  onAthleteAction: () => void;
  onDisconnectStrava: () => Promise<void>;
  isSyncing: boolean;
  stravaStatus: string;
}

export const Header: React.FC<HeaderProps> = ({
  weekTitle,
  canGoToPreviousWeek,
  isAuthenticated,
  completedCount,
  allClubAthletesCount,
  syncedCount,
  totalTeamKm,
  onOpenSettings,
  onPreviousWeek,
  onNextWeek,
  onSyncStrava,
  onSyncAll,
  isAdmin,
  onAdminAction,
  athleteName,
  onAthleteAction,
  onDisconnectStrava,
  isSyncing,
  stravaStatus,
}) => {
  const [isDisconnecting, setIsDisconnecting] = React.useState(false);

  const disconnectStrava = async () => {
    setIsDisconnecting(true);
    try {
      await onDisconnectStrava();
    } finally {
      setIsDisconnecting(false);
    }
  };
  const formattedTeamKm = Number.isInteger(totalTeamKm)
    ? totalTeamKm.toLocaleString()
    : totalTeamKm.toFixed(1);

  return (
    <header className="mb-6">
      {/* Top Banner & Action Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-kmutt-border">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-kmutt-orange"></span>
            <span className="text-kmutt-orange font-bold text-sm tracking-widest uppercase">
              KMUTT ATHLETICS × TUMPANG GAMES
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-white mt-1 tracking-tight">
            เช็คการซ้อมตามโปรแกรม
          </h1>
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={onPreviousWeek}
              disabled={!canGoToPreviousWeek}
              aria-label="สัปดาห์ก่อน"
              className="rounded-lg border border-kmutt-border p-1.5 text-gray-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <p className="text-sm text-gray-300" aria-live="polite">
              {weekTitle}
            </p>
            <button
              type="button"
              onClick={onNextWeek}
              aria-label="สัปดาห์ถัดไป"
              className="rounded-lg border border-kmutt-border p-1.5 text-gray-300 transition hover:bg-white/10"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Right side stats & buttons */}
        <div className="flex flex-wrap items-center gap-3">
          {isAuthenticated && (
            <div className="grid min-w-[250px] grid-cols-2 gap-2">
              <div className="rounded-2xl border border-kmutt-border bg-gradient-to-br from-kmutt-card to-black/20 px-3.5 py-3 shadow-lg shadow-black/10">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                  คนครบโปรแกรม
                </p>
                <p className="mt-1 whitespace-nowrap text-xl font-black leading-none text-white">
                  {completedCount}
                  <span className="ml-1 text-xs font-medium text-gray-400">
                    / {allClubAthletesCount} คน
                  </span>
                </p>
                <p className="mt-1.5 text-[9px] text-gray-500">
                  ซิงค์แล้ว {syncedCount}/{allClubAthletesCount} คน
                </p>
              </div>
              <div className="rounded-2xl border border-kmutt-orange/30 bg-gradient-to-br from-kmutt-orange/15 to-kmutt-card px-3.5 py-3 shadow-lg shadow-kmutt-orange/5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-kmutt-orange">
                  เฉลี่ยต่อคน
                </p>
                <p className="mt-1 whitespace-nowrap text-xl font-black leading-none text-white">
                  {syncedCount > 0
                    ? (totalTeamKm / syncedCount).toFixed(1)
                    : "0.0"}
                  <span className="ml-1 text-[10px] font-bold text-gray-300">
                    กม./คน
                  </span>
                </p>
                <p className="mt-1.5 text-[9px] text-gray-400">
                  รวม {formattedTeamKm} กม. · สัปดาห์นี้
                </p>
              </div>
            </div>
          )}

          {/* Quick Buttons */}
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {isAdmin ? (
              <button
                onClick={onSyncAll}
                disabled={isSyncing}
                title="Sync all connected athletes for this week"
                className="flex items-center gap-1.5 rounded-xl border border-[#fc4c02]/40 bg-[#fc4c02]/20 px-3 py-2 text-xs font-semibold text-[#fc4c02] transition hover:bg-[#fc4c02]/30 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>{isSyncing ? "กำลังซิงค์..." : "ซิงค์ทั้งหมด"}</span>
              </button>
            ) : null}
            {athleteName ? (
              <>
                <span className="hidden text-xs text-gray-400 sm:inline">
                  {athleteName}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-[#fc5200]/40 bg-[#fc5200]/10 px-2 py-1 text-[10px] font-semibold text-[#fc5200]">
                  <StravaIcon className="h-3 w-3" />
                  Strava connected
                </span>
                <button
                  onClick={onSyncStrava}
                  disabled={isSyncing}
                  title="Sync your own Strava activities"
                  className="flex items-center gap-1.5 rounded-xl border border-[#fc4c02]/40 bg-[#fc4c02]/20 px-3 py-2 text-xs font-semibold text-[#fc4c02] transition hover:bg-[#fc4c02]/30 disabled:opacity-60"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>{isSyncing ? "กำลังซิงค์..." : "ซิงค์ Strava"}</span>
                </button>
                <button
                  onClick={onAthleteAction}
                  title="Sign out of athlete account"
                  className="flex items-center gap-1.5 rounded-xl border border-kmutt-border bg-kmutt-card px-3 py-2 text-xs font-semibold text-gray-300 transition hover:bg-kmutt-cardHover"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>ออกจากระบบนักกีฬา</span>
                </button>
                <button
                  onClick={() => void disconnectStrava()}
                  disabled={isDisconnecting}
                  title="ยกเลิกการเชื่อมต่อและลบข้อมูล Strava ที่บันทึกไว้"
                  className="flex items-center gap-1.5 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span>
                    {isDisconnecting
                      ? "กำลังยกเลิก..."
                      : "ยกเลิกการเชื่อมต่อ Strava (Disconnect)"}
                  </span>
                </button>
              </>
            ) : (
              <ConnectWithStravaButton />
            )}
            {isAdmin ? (
              <button
                onClick={onOpenSettings}
                title="แก้ไขโปรแกรมหรือรายชื่อ"
                className="flex items-center gap-1.5 rounded-xl border border-kmutt-border bg-kmutt-card px-3 py-2 text-xs font-semibold text-gray-300 transition hover:bg-kmutt-cardHover"
              >
                <Settings className="h-3.5 w-3.5" />
                <span>แก้ไข</span>
              </button>
            ) : null}
            <button
              onClick={onAdminAction}
              title={isAdmin ? "ออกจากระบบผู้ดูแล" : "เข้าสู่ระบบผู้ดูแล"}
              className="flex items-center gap-1.5 rounded-xl border border-kmutt-border bg-kmutt-card px-3 py-2 text-xs font-semibold text-gray-300 transition hover:bg-kmutt-cardHover"
            >
              {isAdmin ? <LogOut className="h-3.5 w-3.5" /> : <LogIn className="h-3.5 w-3.5" />}
              <span>{isAdmin ? "ออกจากระบบผู้ดูแล" : "Admin login"}</span>
            </button>
          </div>
        </div>
      </div>

      {stravaStatus && (
        <p role="status" className="mt-2 text-xs text-gray-400">
          {stravaStatus}
        </p>
      )}
    </header>
  );
};
