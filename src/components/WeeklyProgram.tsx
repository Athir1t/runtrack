"use client";

import React from "react";
import { ProgramConfig } from "@/types";
import { getWorkoutType, workoutStyles } from "@/utils/workout";

interface WeeklyProgramProps {
  program: ProgramConfig;
}

export const WeeklyProgram: React.FC<WeeklyProgramProps> = ({ program }) => {
  const hasDistanceEstimates = program.schedule.every(
    (day) =>
      day.targetMaleKm !== undefined && day.targetFemaleKm !== undefined
  );
  const maleDailyTargets = program.schedule.map((day) => day.targetMaleKm ?? 0);
  const femaleDailyTargets = program.schedule.map(
    (day) => day.targetFemaleKm ?? 0
  );
  const maleTotalKm = maleDailyTargets.reduce((total, distance) => total + distance, 0);
  const femaleTotalKm = femaleDailyTargets.reduce(
    (total, distance) => total + distance,
    0
  );
  const formatKm = (distance: number) =>
    Number.isInteger(distance) ? String(distance) : distance.toFixed(1);
  const fullMinRuns =
    program.criteria.fullMinRuns ?? program.schedule.filter((day) => !day.isRest).length;
  const fullMinPercent = program.criteria.fullMinPercent ?? 90;
  const almostMinPercent = program.criteria.almostMinPercent ?? 65;

  return (
    <section className="mb-6">
      {/* 7 Days Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
        {program.schedule.map((item, idx) => {
          const style = workoutStyles[getWorkoutType(item)];
          return (
            <div
              key={idx}
              className={`p-3 rounded-xl border transition flex flex-col justify-between min-h-[96px] ${style.card}`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-xs font-bold px-1.5 py-0.5 rounded ${style.badge}`}
                >
                  {item.day}
                </span>
                {item.isRace && (
                  <span className="text-[10px] uppercase font-bold text-kmutt-orange">
                    Race
                  </span>
                )}
              </div>

              <div className="mt-2">
                <div className={`font-bold text-sm leading-tight ${style.accent}`}>
                  {item.title}
                </div>
                {item.subtitle && (
                  <div className="text-xs text-gray-400 mt-0.5">
                    {item.subtitle}
                  </div>
                )}
                {item.targetMaleKm !== undefined &&
                  item.targetFemaleKm !== undefined && (
                    <div className="mt-1.5 inline-flex rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[10px] font-semibold text-gray-300">
                      ~{formatKm(item.targetMaleKm)} กม. (ญ ~
                      {formatKm(item.targetFemaleKm)} กม.)
                    </div>
                  )}
              </div>
            </div>
          );
        })}
      </div>

      {hasDistanceEstimates && (
        <div className="mt-3 rounded-xl border border-kmutt-orange/30 bg-kmutt-orange/10 px-3.5 py-2.5 text-xs text-gray-200">
          <span className="font-semibold text-kmutt-orange">
            รวมเป้าหมายทั้งสัปดาห์:{" "}
          </span>
          ชาย {maleDailyTargets.map(formatKm).join("+")} = {maleTotalKm.toFixed(1)} กม.
          <span className="mx-1.5 text-gray-500">|</span>
          หญิง {femaleDailyTargets.map(formatKm).join("+")} = {femaleTotalKm.toFixed(1)} กม.
        </div>
      )}

      <div
        aria-label="Workout color legend"
        className="mt-3 flex flex-wrap gap-2 text-[11px] font-medium"
      >
        {(["easy", "interval", "tempo", "long"] as const).map((type) => (
          <span
            key={type}
            className={`rounded-full border px-2.5 py-1 ${workoutStyles[type].badge}`}
          >
            {type === "long" ? "Long run" : type[0].toUpperCase() + type.slice(1)}
          </span>
        ))}
      </div>

      {/* Criteria Rules Banner */}
      <div className="mt-3 bg-kmutt-card/60 border border-kmutt-border px-3.5 py-2.5 rounded-xl text-xs text-gray-400 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-green-400 font-semibold">
          • ครบโปรแกรม:
        </span>
        <span>
          ซ้อมอย่างน้อย {fullMinRuns} วัน และได้อย่างน้อย {fullMinPercent}% ของระยะเป้าหมาย
        </span>
        <span className="text-gray-600 hidden sm:inline">|</span>
        <span className="text-amber-400 font-semibold">
          • เกือบครบ:
        </span>
        <span>
          {program.criteria.almostMinRuns} วันขึ้นไป และได้{" "}
          {almostMinPercent}%
        </span>
        <span className="text-gray-400">
          หรือได้ระยะทางครบ 100% และขาดวันซ้อมไม่เกิน 1 วัน
        </span>
        <span className="text-gray-600 hidden sm:inline">|</span>
        <span className="text-gray-300">
          % เทียบปริมาณทั้งสัปดาห์ (ชาย {program.targetMaleKm} กม. · หญิง{" "}
          {program.targetFemaleKm} กม.) ไม่ต้องตรงวัน
        </span>
      </div>
    </section>
  );
};
