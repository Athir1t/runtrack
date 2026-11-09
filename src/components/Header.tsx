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

interface HeaderProps {
  weekTitle: string;
  canGoToPreviousWeek: boolean;
  completedCount: number;
  totalAthletesCount: number;
  totalTeamKm: number;
  onOpenSettings: () => void;
  onPreviousWeek: () => void;
  onNextWeek: () => void;
  onSyncStrava: () => Promise<void>;
  isAdmin: boolean;
  onAdminAction: () => void;
  isSyncing: boolean;
  isStravaConnected: boolean | null;
  stravaStatus: string;
}

export const Header: React.FC<HeaderProps> = ({
  weekTitle,
  canGoToPreviousWeek,
  completedCount,
  totalAthletesCount,
  totalTeamKm,
  onOpenSettings,
  onPreviousWeek,
  onNextWeek,
  onSyncStrava,
  isAdmin,
  onAdminAction,
  isSyncing,
  isStravaConnected,
  stravaStatus,
}) => {
  return (
    <header className="mb-6">
      {/* Top Banner & Action Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-kmutt-border">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-kmutt-orange animate-pulse"></span>
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
          <div className="flex items-center gap-4 bg-kmutt-card border border-kmutt-border px-4 py-2.5 rounded-xl">
            <div className="text-right">
              <div className="text-2xl md:text-3xl font-black text-white leading-none">
                {completedCount}{" "}
                <span className="text-base text-gray-500 font-normal">
                  / {totalAthletesCount}
                </span>
              </div>
              <div className="text-[11px] text-gray-400 font-medium mt-0.5">
                คนครบโปรแกรม
              </div>
            </div>

            <div className="h-8 w-px bg-kmutt-border"></div>

            <div className="text-right">
              <div className="text-2xl md:text-3xl font-black text-white leading-none">
                {totalTeamKm.toLocaleString()}
              </div>
              <div className="text-[11px] text-gray-400 font-medium mt-0.5">
                กม. สัปดาห์นี้
              </div>
            </div>
          </div>

          {/* Quick Buttons */}
          <div className="flex items-center gap-2">
            {isAdmin ? (
              <>
                <button
                  onClick={onSyncStrava}
                  disabled={isSyncing || isStravaConnected === null}
                  title={
                    isStravaConnected
                      ? "ดึงข้อมูลสัปดาห์นี้จาก Strava"
                      : "เชื่อมต่อบัญชี Strava"
                  }
                  className="flex items-center gap-1.5 rounded-xl border border-[#fc4c02]/40 bg-[#fc4c02]/20 px-3 py-2 text-xs font-semibold text-[#fc4c02] transition hover:bg-[#fc4c02]/30"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? "animate-spin" : ""}`} />
                  <span>
                    {isSyncing
                      ? "กำลังซิงค์..."
                      : isStravaConnected === null
                      ? "กำลังตรวจสอบ..."
                      : isStravaConnected
                      ? "ซิงค์ Strava"
                      : "เชื่อมต่อ Strava"}
                  </span>
                </button>
                <button
                  onClick={onOpenSettings}
                  title="แก้ไขโปรแกรมหรือรายชื่อ"
                  className="flex items-center gap-1.5 rounded-xl border border-kmutt-border bg-kmutt-card px-3 py-2 text-xs font-semibold text-gray-300 transition hover:bg-kmutt-cardHover"
                >
                  <Settings className="h-3.5 w-3.5" />
                  <span>แก้ไข</span>
                </button>
              </>
            ) : null}
            <button
              onClick={onAdminAction}
              title={isAdmin ? "ออกจากระบบผู้ดูแล" : "เข้าสู่ระบบเพื่อซิงค์หรือแก้ไข"}
              className="flex items-center gap-1.5 rounded-xl border border-kmutt-border bg-kmutt-card px-3 py-2 text-xs font-semibold text-gray-300 transition hover:bg-kmutt-cardHover"
            >
              {isAdmin ? (
                <LogOut className="h-3.5 w-3.5" />
              ) : (
                <LogIn className="h-3.5 w-3.5" />
              )}
              <span>{isAdmin ? "ออกจากระบบ" : "Admin login"}</span>
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
