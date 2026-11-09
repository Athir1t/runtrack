"use client";

import React from "react";
import { EvaluatedAthlete } from "@/types";

interface LeaderboardTableProps {
  rankedAthletes: EvaluatedAthlete[];
  weekStartDate: string;
}

export const LeaderboardTable: React.FC<LeaderboardTableProps> = ({
  rankedAthletes,
  weekStartDate,
}) => {
  return (
    <section className="bg-kmutt-card border border-kmutt-border rounded-2xl overflow-hidden shadow-2xl">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-gray-200">
          <thead>
            <tr className="border-b border-kmutt-border/80 text-gray-400 text-xs font-semibold uppercase tracking-wider bg-black/20">
              <th className="py-3.5 px-4 w-12 text-center">#</th>
              <th className="py-3.5 px-4">นักกีฬา</th>
              <th className="py-3.5 px-4 text-right">ระยะ</th>
              <th className="py-3.5 px-4 text-center">วันซ้อม</th>
              <th className="py-3.5 px-4 text-center">% โปรแกรม</th>
              <th className="py-3.5 px-4 text-right">สถานะ</th>
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
                    <span className="text-base font-extrabold text-white">
                      {athlete.isSynced === false
                        ? "—"
                        : athlete.distanceKm.toFixed(1)}
                    </span>{" "}
                    <span className="text-xs text-gray-400 font-normal">กม.</span>
                  </td>

                  {/* Runs count */}
                  <td className="py-3 px-4 text-center text-base font-bold text-white">
                    {athlete.isSynced === false
                      ? "—"
                      : `${athlete.trainingDays ?? athlete.runsCount}/${athlete.programTrainingDays}`}
                  </td>

                  {/* % of Program */}
                  <td className="py-3 px-4 text-center font-bold text-sm">
                    {athlete.isSynced === false ? (
                      <span className="text-gray-500">—</span>
                    ) : athlete.status === "completed" ? (
                      <span className="text-green-400">{athlete.percent}%</span>
                    ) : (
                      <span className="text-gray-300">{athlete.percent}%</span>
                    )}
                  </td>

                  {/* Status Badge */}
                  <td className="py-3 px-4 text-right">
                    {athlete.isSynced === false ? (
                      <span className="inline-flex items-center rounded-full border border-gray-600 bg-gray-700/40 px-3 py-1 text-xs font-bold text-gray-300">
                        ยังไม่ซิงค์
                      </span>
                    ) : athlete.status === "completed" ? (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-[#063319] text-[#4ade80] border border-[#166534]">
                        ครบโปรแกรม
                      </span>
                    ) : athlete.status === "almost" ? (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-[#3f2105] text-[#fbbf24] border border-[#854d0e]">
                        เกือบครบ
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-[#1f2937] text-[#9ca3af] border border-[#374151]">
                        ยังไม่ครบ
                      </span>
                    )}
                  </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

        {/* Footer Notes */}
        <div className="px-4 py-2.5 bg-black/30 border-t border-kmutt-border/40 text-[11px] text-gray-500 text-center sm:text-left">
          ระยะรวมจากกิจกรรมวิ่งใน Strava · วันซ้อมนับวันที่มีกิจกรรมในวันฝึกตามโปรแกรม โดยไม่นับวันพัก
        </div>
    </section>
  );
};
