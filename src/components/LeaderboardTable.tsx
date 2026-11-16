"use client";

import React from "react";
import { DaySchedule, EvaluatedAthlete } from "@/types";
import { PoweredByStravaLogo } from "@/components/StravaBrand";

interface LeaderboardTableProps {
  rankedAthletes: EvaluatedAthlete[];
  weekStartDate: string;
  schedule: DaySchedule[];
  isLoading: boolean;
}

export const LeaderboardTable: React.FC<LeaderboardTableProps> = ({
  rankedAthletes,
  weekStartDate,
  schedule,
  isLoading,
}) => {
  return (
    <section
      aria-busy={isLoading}
      className={`bg-kmutt-card border border-kmutt-border rounded-2xl overflow-hidden shadow-2xl ${
        isLoading ? "invisible" : "visible"
      }`}
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px] table-fixed text-left text-sm text-gray-200">
          <thead>
            <tr className="border-b border-kmutt-border/80 text-gray-400 text-xs font-semibold uppercase tracking-wider bg-black/20">
              <th className="py-3.5 px-4 w-12 text-center">#</th>
              <th className="py-3.5 px-4 w-[34%]">นักกีฬา</th>
              <th className="py-3.5 px-4 w-[13%] text-right">ระยะ</th>
              <th className="py-3.5 px-4 w-[12%] text-center">วันซ้อม</th>
              <th className="py-3.5 px-4 w-[15%] text-center">% โปรแกรม</th>
              <th className="py-3.5 px-4 w-[18%] text-right">สถานะ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-kmutt-border/50 font-medium">
            {rankedAthletes.map((athlete) => (
              <tr
                key={athlete.id}
                className="hover:bg-kmutt-cardHover/70 transition-colors"
              >
                  {/* Rank */}
                  <td className="py-3 px-4 text-center font-bold text-gray-400">
                    {athlete.isSynced === false ? "—" : athlete.rank}
                  </td>

                  {/* Nickname & Strava Name */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-kmutt-border flex items-center justify-center font-bold text-xs text-white uppercase border border-white/10 shrink-0">
                        {athlete.nickname.slice(0, 2)}
                      </div>
                      <div>
                        <div className="font-bold text-white text-base leading-tight">
                          {athlete.inClub && athlete.stravaName && athlete.isSynced ? (
                            <a
                              href={`/athletes/${encodeURIComponent(
                                athlete.id
                              )}?weekStart=${encodeURIComponent(weekStartDate)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="เปิดกิจกรรมในแท็บใหม่"
                              className="text-left decoration-kmutt-orange/70 underline-offset-4 transition hover:text-kmutt-orange hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kmutt-orange"
                            >
                              {athlete.nickname}
                            </a>
                          ) : (
                            athlete.nickname
                          )}
                          <span className="text-[11px] font-normal text-gray-500 ml-1.5">
                            ({athlete.gender === "F" ? "หญิง" : "ชาย"})
                          </span>
                        </div>
                        {athlete.stravaName && (
                          <div className="text-[11px] text-gray-400 truncate max-w-[140px] sm:max-w-xs">
                            Strava: {athlete.stravaName}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Distance */}
                  <td className="py-3 px-4 text-right">
                    {athlete.isSynced === false ? (
                      <span className="text-base font-extrabold text-gray-500">—</span>
                    ) : (
                      <>
                        <div>
                          <span className="text-base font-extrabold text-white">
                            {athlete.distanceKm.toFixed(1)}
                          </span>{" "}
                          <span className="text-xs text-gray-400 font-normal">กม.</span>
                        </div>
                        <div className="mt-0.5 text-[10px] font-normal text-gray-400">
                          {athlete.targetKm === null
                            ? "เป้าหมาย: Null"
                            : athlete.distanceKm < athlete.targetKm
                              ? `เป้า: ${athlete.targetKm.toFixed(1)} กม. (ขาด ${(athlete.targetKm - athlete.distanceKm).toFixed(1)} กม.)`
                              : athlete.distanceKm > athlete.targetKm
                                ? `เป้า: ${athlete.targetKm.toFixed(1)} กม. (+${(athlete.distanceKm - athlete.targetKm).toFixed(1)} กม.)`
                                : `ถึงเป้า ${athlete.targetKm.toFixed(1)} กม.`}
                        </div>
                      </>
                    )}
                  </td>

                  {/* Runs count */}
                  <td className="py-3 px-2 text-center">
                    {athlete.isSynced === false ? (
                      <span className="text-base font-bold text-gray-500">—</span>
                    ) : (
                      <>
                        <div className="text-base font-bold text-white">
                          {athlete.trainingDays ?? athlete.runsCount}/{athlete.programTrainingDays}
                        </div>
                        <div
                          aria-label="วันซ้อมตั้งแต่วันจันทร์ถึงวันอาทิตย์"
                          className="mt-1 flex justify-center gap-0.5"
                        >
                          {schedule.map((day, dayIndex) => {
                            const isRestDay = Boolean(day.isRest);
                            const isCompleted =
                              !isRestDay &&
                              athlete.trainingDayIndexes?.includes(dayIndex) === true;
                            const label = ["จ", "อ", "พ", "พฤ", "ศ", "ส", "อา"][dayIndex] ?? day.day;
                            const stateLabel = isRestDay
                              ? "วันพัก"
                              : isCompleted
                                ? "ซ้อมแล้ว"
                                : "ขาดซ้อม";

                            return (
                              <span
                                key={`${day.day}-${dayIndex}`}
                                aria-label={`${label}: ${stateLabel}`}
                                title={`${label}: ${stateLabel}`}
                                className={`flex h-4 min-w-4 items-center justify-center rounded px-0.5 text-[9px] font-semibold leading-none ${
                                  isRestDay
                                    ? "border border-gray-600 text-gray-500"
                                    : isCompleted
                                      ? "bg-green-800 text-green-200"
                                      : "bg-red-950 text-red-300"
                                }`}
                              >
                                {isRestDay ? label : isCompleted ? label : "–"}
                              </span>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </td>

                  {/* % of Program */}
                  <td className="py-3 px-2 text-center font-bold text-sm">
                    {athlete.isSynced === false ? (
                      <span className="text-gray-500">—</span>
                    ) : (
                      <>
                        <div className={athlete.status === "completed" ? "text-green-400" : "text-gray-300"}>
                          {athlete.percent === null ? "Null" : `${athlete.percent}%`}
                        </div>
                        <div className="mt-0.5 whitespace-nowrap text-[10px] font-normal text-gray-400">
                          ({athlete.distanceKm.toFixed(1)} /{" "}
                          {athlete.targetKm === null
                            ? "Null"
                            : athlete.targetKm.toFixed(1)}{" "}
                          กม.)
                        </div>
                      </>
                    )}
                  </td>

                  {/* Status Badge */}
                  <td className="py-3 px-4 text-right">
                    {athlete.isSynced === false ? (
                      <span className="inline-flex whitespace-nowrap items-center rounded-full border border-gray-600 bg-gray-700/40 px-3 py-1 text-xs font-bold text-gray-300">
                        ยังไม่ซิงค์
                      </span>
                    ) : athlete.status === "completed" ? (
                      <span
                        title={athlete.statusReason}
                        aria-label={`ครบโปรแกรม: ${athlete.statusReason}`}
                        className="inline-flex whitespace-nowrap items-center px-3 py-1 rounded-full text-xs font-bold bg-[#063319] text-[#4ade80] border border-[#166534]"
                      >
                        ครบโปรแกรม
                      </span>
                    ) : athlete.status === "almost" ? (
                      <span
                        title={athlete.statusReason}
                        aria-label={`เกือบครบ: ${athlete.statusReason}`}
                        className="inline-flex whitespace-nowrap items-center px-3 py-1 rounded-full text-xs font-bold bg-[#3f2105] text-[#fbbf24] border border-[#854d0e]"
                      >
                        เกือบครบ
                      </span>
                    ) : (
                      <span
                        title={athlete.statusReason}
                        aria-label={`ยังไม่ครบ: ${athlete.statusReason}`}
                        className="inline-flex whitespace-nowrap items-center px-3 py-1 rounded-full text-xs font-bold bg-[#1f2937] text-[#9ca3af] border border-[#374151]"
                      >
                        ยังไม่ครบ
                      </span>
                    )}
                    {athlete.isSynced !== false && (
                      <div
                        title={athlete.statusReason}
                        className="mt-1 line-clamp-2 text-left text-[10px] font-normal leading-tight text-gray-400"
                      >
                        {athlete.statusReason}
                      </div>
                    )}
                  </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

        {/* Footer Notes */}
        <div className="flex flex-col items-center justify-between gap-3 border-t border-kmutt-border/40 bg-black/30 px-4 py-2.5 text-center sm:flex-row sm:text-left">
          <p className="text-[11px] text-gray-500">
            ระยะทางและรอบวิ่งซิงค์ผ่าน Strava API · วันซ้อมนับวันที่มีกิจกรรมอย่างน้อย 1 กม. และ 5 นาทีในวันฝึกตามโปรแกรม ไม่รวมวันพัก
          </p>
          <PoweredByStravaLogo className="shrink-0 opacity-80 transition-opacity hover:opacity-100" />
        </div>
    </section>
  );
};
