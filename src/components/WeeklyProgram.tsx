"use client";

import React, { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { ProgramConfig } from "@/types";
import { exportProgramCsv } from "@/utils/csv-export";
import {
  formatProgramKm,
  getDayTargetKm,
  getThaiDayName,
  getWeeklyTargetKm,
} from "@/utils/program";
import { getWorkoutType, workoutStyles } from "@/utils/workout";

interface WeeklyProgramProps {
  program: ProgramConfig;
}

function formatExpressionKm(value: number | null): string {
  return value === null
    ? "Null"
    : Number.isInteger(value)
      ? String(value)
      : value.toFixed(1);
}

export const WeeklyProgram: React.FC<WeeklyProgramProps> = ({ program }) => {
  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null);
  const maleTotalKm = getWeeklyTargetKm(program.schedule, "M");
  const femaleTotalKm = getWeeklyTargetKm(program.schedule, "F");
  const maleDailyTargets = program.schedule.map((day) =>
    day.isRest ? 0 : getDayTargetKm(day, "M")
  );
  const femaleDailyTargets = program.schedule.map((day) =>
    day.isRest ? 0 : getDayTargetKm(day, "F")
  );
  const programTrainingDays = program.schedule.filter((day) => !day.isRest).length;
  const fullMinPercent = program.criteria.fullMinPercent ?? 90;
  const almostMinPercent = program.criteria.almostMinPercent ?? 65;
  const selectedDay =
    selectedDayIndex === null ? null : program.schedule[selectedDayIndex];

  useEffect(() => {
    if (selectedDayIndex === null) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedDayIndex(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedDayIndex]);

  return (
    <section className="mb-6">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-7">
        {program.schedule.map((item, index) => {
          const style = workoutStyles[getWorkoutType(item)];
          const maleKm = getDayTargetKm(item, "M");
          const femaleKm = getDayTargetKm(item, "F");
          return (
            <article
              key={`${item.day}-${index}`}
              className={`flex min-h-[150px] flex-col rounded-xl border p-3 transition ${style.card}`}
            >
              <div className="flex items-start justify-between gap-1">
                <span className={`rounded-md px-2 py-1 text-[11px] font-bold ${style.badge}`}>
                  {getThaiDayName(item.day, index)}
                </span>
                {item.isRest ? (
                  <span className="text-[10px] font-semibold text-gray-400">
                    วันพัก
                  </span>
                ) : item.isRace ? (
                  <span className="text-[10px] font-bold uppercase text-kmutt-orange">
                    Race
                  </span>
                ) : null}
              </div>

              <div className="mt-2 flex-1">
                <div className={`text-sm font-bold leading-tight ${style.accent}`}>
                  {item.title}
                </div>
                {item.subtitle && (
                  <div className="mt-0.5 text-xs text-gray-400">{item.subtitle}</div>
                )}
                {item.detail && (
                  <p className="mt-1 line-clamp-2 whitespace-pre-line text-[10px] leading-4 text-gray-500">
                    {item.detail}
                  </p>
                )}
                  <button
                    type="button"
                    aria-haspopup="dialog"
                    aria-label={`ดูรายละเอียด${getThaiDayName(item.day, index)}`}
                    onClick={() => setSelectedDayIndex(index)}
                    className="mt-1 text-[10px] font-semibold text-kmutt-orange underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kmutt-orange"
                  >
                    ดูรายละเอียด
                  </button>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-1.5 border-t border-white/10 pt-2">
                <div className="rounded-lg border border-sky-400/20 bg-sky-400/5 px-2 py-1">
                  <span className="block text-[9px] font-semibold text-sky-300">
                    ชาย
                  </span>
                  <span className="text-xs font-bold text-white">
                    {item.isRest ? "0" : formatProgramKm(maleKm)}{" "}
                    <span className="text-[9px] font-medium text-gray-400">กม.</span>
                  </span>
                </div>
                <div className="rounded-lg border border-pink-400/20 bg-pink-400/5 px-2 py-1">
                  <span className="block text-[9px] font-semibold text-pink-300">
                    หญิง
                  </span>
                  <span className="text-xs font-bold text-white">
                    {item.isRest ? "0" : formatProgramKm(femaleKm)}{" "}
                    <span className="text-[9px] font-medium text-gray-400">กม.</span>
                  </span>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <div className="mt-3 rounded-xl border border-kmutt-orange/30 bg-gradient-to-r from-kmutt-orange/10 via-kmutt-card to-kmutt-card px-4 py-3 text-xs text-gray-200 shadow-lg shadow-black/10">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-bold text-kmutt-orange">
            รวมเป้าหมายทั้งสัปดาห์
          </p>
          <button
            type="button"
            onClick={() => exportProgramCsv(program)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-kmutt-orange/40 px-2.5 py-1.5 text-[10px] font-semibold text-kmutt-orange"
          >
            <Download className="h-3.5 w-3.5" />
            ดาวน์โหลดโปรแกรม CSV
          </button>
        </div>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <p>
            <span className="font-semibold text-sky-300">ชาย </span>
            <span className="font-medium tabular-nums">
              {maleDailyTargets.map(formatExpressionKm).join("+")} ={" "}
              {formatProgramKm(maleTotalKm)} กม.
            </span>
          </p>
          <p>
            <span className="font-semibold text-pink-300">หญิง </span>
            <span className="font-medium tabular-nums">
              {femaleDailyTargets.map(formatExpressionKm).join("+")} ={" "}
              {formatProgramKm(femaleTotalKm)} กม.
            </span>
          </p>
        </div>
      </div>

      {selectedDay && selectedDayIndex !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedDayIndex(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="program-day-dialog-title"
            className="w-full max-w-lg rounded-2xl border border-kmutt-border bg-kmutt-card p-5 text-gray-200 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-kmutt-orange">
                  {getThaiDayName(selectedDay.day, selectedDayIndex)}
                </p>
                <h2
                  id="program-day-dialog-title"
                  className="mt-1 text-lg font-bold text-white"
                >
                  {selectedDay.title}
                  {selectedDay.subtitle ? ` ${selectedDay.subtitle}` : ""}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDayIndex(null)}
                aria-label="ปิดรายละเอียด"
                className="rounded-lg p-1.5 text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kmutt-orange"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-4 whitespace-pre-wrap rounded-xl border border-kmutt-border bg-kmutt-dark p-4 text-sm leading-6">
              {selectedDay.detail || "ไม่มีรายละเอียดเพิ่มเติม"}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <p className="rounded-lg border border-sky-400/20 bg-sky-400/5 p-3">
                <span className="block text-xs text-sky-300">ชาย</span>
                <span className="font-bold text-white">
                  {selectedDay.isRest
                    ? "0"
                    : formatProgramKm(getDayTargetKm(selectedDay, "M"))}{" "}
                  กม.
                </span>
              </p>
              <p className="rounded-lg border border-pink-400/20 bg-pink-400/5 p-3">
                <span className="block text-xs text-pink-300">หญิง</span>
                <span className="font-bold text-white">
                  {selectedDay.isRest
                    ? "0"
                    : formatProgramKm(getDayTargetKm(selectedDay, "F"))}{" "}
                  กม.
                </span>
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-medium">
        {(["easy", "interval", "tempo", "long"] as const).map((type) => (
          <span
            key={type}
            className={`rounded-full border px-2.5 py-1 ${workoutStyles[type].badge}`}
          >
            {type === "long" ? "Long run" : type[0].toUpperCase() + type.slice(1)}
          </span>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-kmutt-border bg-kmutt-card/70 px-3.5 py-2.5 text-xs text-gray-400">
        <span className="font-semibold text-green-400">ครบโปรแกรม:</span>
        <span>
          ซ้อมครบ {programTrainingDays} วันตามตาราง และได้อย่างน้อย {fullMinPercent}%
          ของเป้าหมายรายสัปดาห์
        </span>
        <span className="hidden text-gray-600 sm:inline">|</span>
        <span className="font-semibold text-amber-400">เกือบครบ:</span>
        <span>
          {program.criteria.almostMinRuns} วันขึ้นไป และได้ {almostMinPercent}%
          หรือได้ระยะครบ 100% และขาดไม่เกิน 1 วัน
        </span>
      </div>
    </section>
  );
};
