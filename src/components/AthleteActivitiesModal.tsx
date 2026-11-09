"use client";

import React, { useEffect, useState } from "react";
import { Athlete, StravaActivity } from "@/types";
import { Activity, ExternalLink, X } from "lucide-react";

interface AthleteActivitiesModalProps {
  athlete: Athlete;
  onClose: () => void;
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours > 0 ? `${hours} ชม. ${minutes} นาที` : `${minutes} นาที`;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "ไม่ทราบวันที่";
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export const AthleteActivitiesModal: React.FC<AthleteActivitiesModalProps> = ({
  athlete,
  onClose,
}) => {
  const [activities, setActivities] = useState<StravaActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadActivities() {
      try {
        const response = await fetch(
          `/api/athletes/${encodeURIComponent(athlete.id)}/activities`,
          { signal: controller.signal }
        );
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.message || "ไม่สามารถโหลดกิจกรรมได้");
        }
        setActivities(data.activities);
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

    loadActivities();
    return () => controller.abort();
  }, [athlete.id]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="athlete-activities-title"
        className="flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-kmutt-border bg-kmutt-card shadow-2xl"
      >
        <header className="flex items-start justify-between border-b border-kmutt-border px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-kmutt-orange/15 text-kmutt-orange">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <h2 id="athlete-activities-title" className="text-lg font-bold text-white">
                กิจกรรมของ {athlete.nickname}
              </h2>
              <p className="text-xs text-gray-400">กิจกรรมวิ่งล่าสุดในคลับ Strava</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิด"
            className="rounded-lg p-2 text-gray-400 transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="overflow-y-auto p-5">
          {isLoading ? (
            <p className="py-8 text-center text-sm text-gray-400">กำลังโหลดกิจกรรม...</p>
          ) : error ? (
            <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
              {error}
              {error.includes("เชื่อมต่อบัญชี Strava") && (
                <a
                  href="/api/strava/auth"
                  className="ml-1 font-semibold underline hover:text-white"
                >
                  เชื่อมต่อที่นี่
                </a>
              )}
            </p>
          ) : activities.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">
              ไม่พบกิจกรรมวิ่งล่าสุดของนักกีฬาคนนี้ในคลับ
            </p>
          ) : (
            <ul className="space-y-3">
              {activities.map((activity) => (
                <li
                  key={activity.id}
                  className="flex items-center justify-between gap-4 rounded-xl border border-kmutt-border bg-black/20 p-4"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-white">{activity.name}</p>
                    <p className="mt-1 text-xs text-gray-400">
                      {formatDate(activity.startDate)}
                    </p>
                    <p className="mt-1 text-xs text-gray-300">
                      {activity.distanceKm.toFixed(2)} กม. ·{" "}
                      {formatDuration(activity.movingTimeSeconds)}
                    </p>
                  </div>
                  <a
                    href={`https://www.strava.com/activities/${activity.id}`}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`เปิด ${activity.name} บน Strava`}
                    className="shrink-0 rounded-lg p-2 text-kmutt-orange transition hover:bg-kmutt-orange/10"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
};
