"use client";

import React, { useEffect, useState } from "react";
import { ProgramConfig, Athlete, DaySchedule } from "@/types";
import { X, Plus, Trash2, Save, UserPlus } from "lucide-react";
import {
  formatProgramKm,
  getThaiDayName,
  getWeeklyTargetKm,
  withDerivedProgramTargets,
} from "@/utils/program";

interface EditModalProps {
  isOpen: boolean;
  onClose: () => void;
  program: ProgramConfig;
  athletes: Athlete[];
  onSave: (newProgram: ProgramConfig, newAthletes: Athlete[]) => Promise<void>;
}

export const EditModal: React.FC<EditModalProps> = ({
  isOpen,
  onClose,
  program,
  athletes,
  onSave,
}) => {
  const [activeTab, setActiveTab] = useState<"program" | "athletes">("program");
  const [editProgram, setEditProgram] = useState<ProgramConfig>(program);
  const [editAthletes, setEditAthletes] = useState<Athlete[]>(athletes);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setEditProgram(program);
  }, [program]);

  useEffect(() => {
    setEditAthletes(athletes);
  }, [athletes]);

  if (!isOpen) return null;

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      await onSave(editProgram, editAthletes);
      onClose();
    } catch (e) {
      alert("เกิดข้อผิดพลาดในการบันทึก");
    } finally {
      setSaving(false);
    }
  };

  const handleAddAthlete = () => {
    const newAthlete: Athlete = {
      id: Date.now().toString(),
      nickname: "นักกีฬาใหม่",
      stravaName: "",
      gender: "M",
      distanceKm: 0,
      runsCount: 0,
      inClub: true,
    };
    setEditAthletes([...editAthletes, newAthlete]);
  };

  const handleRemoveAthlete = (id: string) => {
    setEditAthletes(editAthletes.filter((a) => a.id !== id));
  };

  const updateScheduleDay = (index: number, updates: Partial<DaySchedule>) => {
    setEditProgram((current) =>
      withDerivedProgramTargets({
        ...current,
        schedule: current.schedule.map((day, dayIndex) =>
          dayIndex === index ? { ...day, ...updates } : day
        ),
      })
    );
  };

  const trainingDays = editProgram.schedule.filter((day) => !day.isRest).length;
  const maleTotalKm = getWeeklyTargetKm(editProgram.schedule, "M");
  const femaleTotalKm = getWeeklyTargetKm(editProgram.schedule, "F");

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-kmutt-card border border-kmutt-border rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-kmutt-border bg-black/30">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold text-white">แก้ไขข้อมูลระบบ</h2>
            <div className="flex gap-2 bg-black/40 p-1 rounded-lg border border-kmutt-border">
              <button
                onClick={() => setActiveTab("program")}
                className={`px-3 py-1 rounded text-xs font-semibold transition ${
                  activeTab === "program"
                    ? "bg-kmutt-orange text-white"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                โปรแกรมซ้อม
              </button>
              <button
                onClick={() => setActiveTab("athletes")}
                className={`px-3 py-1 rounded text-xs font-semibold transition ${
                  activeTab === "athletes"
                    ? "bg-kmutt-orange text-white"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                รายชื่อนักกีฬา ({editAthletes.length})
              </button>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm text-gray-200">
          {activeTab === "program" ? (
            <div className="space-y-5">
              {/* General Week Settings */}
              <div className="grid grid-cols-1 gap-4 rounded-2xl border border-kmutt-border bg-gradient-to-br from-white/[0.04] to-transparent p-4 md:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1">
                    หัวข้อสัปดาห์
                  </label>
                  <input
                    type="text"
                    value={editProgram.weekTitle}
                    onChange={(e) =>
                      setEditProgram({
                        ...editProgram,
                        weekTitle: e.target.value,
                      })
                    }
                    className="w-full bg-[#111619] border border-kmutt-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-kmutt-orange"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-sky-400/20 bg-sky-400/5 p-3">
                    <span className="text-[11px] font-semibold text-sky-300">
                      เป้าหมายชาย · รวมรายวัน
                    </span>
                    <p className="mt-1 text-xl font-black text-white">
                      {formatProgramKm(maleTotalKm)}
                      <span className="ml-1 text-xs font-semibold text-gray-400">กม.</span>
                    </p>
                  </div>
                  <div className="rounded-xl border border-pink-400/20 bg-pink-400/5 p-3">
                    <span className="text-[11px] font-semibold text-pink-300">
                      เป้าหมายหญิง · รวมรายวัน
                    </span>
                    <p className="mt-1 text-xl font-black text-white">
                      {formatProgramKm(femaleTotalKm)}
                      <span className="ml-1 text-xs font-semibold text-gray-400">กม.</span>
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 md:col-span-2 md:grid-cols-4">
                  <label className="text-xs font-semibold text-gray-400">
                    วันขั้นต่ำเกือบครบ
                    <input
                      type="number"
                      min="0"
                      max="7"
                      value={editProgram.criteria.almostMinRuns}
                      onChange={(event) =>
                        setEditProgram({
                          ...editProgram,
                          criteria: {
                            ...editProgram.criteria,
                            almostMinRuns: Number(event.target.value),
                          },
                        })
                      }
                      className="mt-1 w-full rounded-lg border border-kmutt-border bg-[#111619] px-3 py-2 text-white"
                    />
                  </label>
                  <label className="text-xs font-semibold text-gray-400">
                    ระยะครบขั้นต่ำ (%)
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={editProgram.criteria.fullMinPercent ?? 90}
                      onChange={(event) =>
                        setEditProgram({
                          ...editProgram,
                          criteria: {
                            ...editProgram.criteria,
                            fullMinPercent: Number(event.target.value),
                          },
                        })
                      }
                      className="mt-1 w-full rounded-lg border border-kmutt-border bg-[#111619] px-3 py-2 text-white"
                    />
                  </label>
                  <label className="text-xs font-semibold text-gray-400">
                    ระยะเกือบครบขั้นต่ำ (%)
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={editProgram.criteria.almostMinPercent ?? 65}
                      onChange={(event) =>
                        setEditProgram({
                          ...editProgram,
                          criteria: {
                            ...editProgram.criteria,
                            almostMinPercent: Number(event.target.value),
                          },
                        })
                      }
                      className="mt-1 w-full rounded-lg border border-kmutt-border bg-[#111619] px-3 py-2 text-white"
                    />
                  </label>
                  <div className="rounded-lg border border-kmutt-border bg-black/20 px-3 py-2 text-xs">
                    <span className="text-gray-400">วันฝึกตามโปรแกรม</span>
                    <p className="mt-1 text-base font-bold text-white">
                      {trainingDays} วัน
                    </p>
                    <span className="text-[10px] text-gray-500">คำนวณจากวันไม่พัก</span>
                  </div>
                </div>
              </div>

              {/* Day Schedules */}
              <div>
                <h3 className="text-sm font-bold text-white mb-3">
                  โปรแกรมรายวัน (วันจันทร์ - วันอาทิตย์)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {editProgram.schedule.map((item, index) => (
                    <div
                      key={index}
                      className={`flex flex-col gap-3 rounded-2xl border p-4 transition ${
                        item.isRest
                          ? "border-gray-600/50 bg-gray-500/[0.04]"
                          : "border-kmutt-border bg-gradient-to-br from-white/[0.035] to-transparent"
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-bold text-kmutt-orange">
                          {getThaiDayName(item.day, index)}
                        </span>
                        <div className="flex items-center gap-3 text-xs text-gray-300">
                          <label className="flex items-center gap-1 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={item.isRest || false}
                              onChange={(event) =>
                                updateScheduleDay(index, {
                                  isRest: event.target.checked,
                                })
                              }
                            />
                            <span>พัก (Rest)</span>
                          </label>
                          <label className="flex items-center gap-1 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={item.isRace || false}
                              onChange={(event) =>
                                updateScheduleDay(index, {
                                  isRace: event.target.checked,
                                })
                              }
                            />
                            <span>แข่ง (Race)</span>
                          </label>
                        </div>
                      </div>
                      <input
                        type="text"
                        aria-label={`${getThaiDayName(item.day, index)} คำอธิบายโปรแกรม`}
                        placeholder="คำอธิบายโปรแกรม เช่น 400 ม. × 15"
                        value={item.title}
                        onChange={(event) =>
                          updateScheduleDay(index, { title: event.target.value })
                        }
                        className="rounded-lg border border-kmutt-border bg-[#111619] px-3 py-2 text-sm text-white focus:border-kmutt-orange focus:outline-none"
                      />
                      <input
                        type="text"
                        aria-label={`${getThaiDayName(item.day, index)} หมายเหตุ`}
                        placeholder="หมายเหตุเพิ่มเติม"
                        value={item.subtitle || ""}
                        onChange={(event) =>
                          updateScheduleDay(index, {
                            subtitle: event.target.value,
                          })
                        }
                        className="rounded-lg border border-kmutt-border bg-[#111619] px-3 py-2 text-xs text-gray-300 focus:border-kmutt-orange focus:outline-none"
                      />
                      <textarea
                        aria-label={`${getThaiDayName(item.day, index)} รายละเอียด`}
                        placeholder="รายละเอียดหรือคำแนะนำการฝึก"
                        value={item.detail || ""}
                        rows={2}
                        onChange={(event) =>
                          updateScheduleDay(index, { detail: event.target.value })
                        }
                        className="resize-y rounded-lg border border-kmutt-border bg-[#111619] px-3 py-2 text-xs text-gray-300 focus:border-kmutt-orange focus:outline-none"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <label className="rounded-lg border border-sky-400/20 bg-sky-400/[0.04] p-2.5 text-[11px] font-semibold text-sky-300">
                          เป้าหมายชาย (กม.)
                          <input
                            type="number"
                            min="0.1"
                            step="0.1"
                            value={item.targetMaleKm ?? ""}
                            disabled={item.isRest}
                            aria-label={`${getThaiDayName(item.day, index)} เป้าหมายชายเป็นกิโลเมตร`}
                            placeholder="Null"
                            onChange={(event) =>
                              updateScheduleDay(index, {
                                targetMaleKm:
                                  event.target.value === ""
                                    ? null
                                    : Number(event.target.value),
                              })
                            }
                            className="mt-1.5 w-full rounded-md border border-kmutt-border bg-[#111619] px-2.5 py-2 text-sm font-bold text-white outline-none focus:border-sky-400 disabled:cursor-not-allowed disabled:opacity-40"
                          />
                        </label>
                        <label className="rounded-lg border border-pink-400/20 bg-pink-400/[0.04] p-2.5 text-[11px] font-semibold text-pink-300">
                          เป้าหมายหญิง (กม.)
                          <input
                            type="number"
                            min="0.1"
                            step="0.1"
                            value={item.targetFemaleKm ?? ""}
                            disabled={item.isRest}
                            aria-label={`${getThaiDayName(item.day, index)} เป้าหมายหญิงเป็นกิโลเมตร`}
                            placeholder="Null"
                            onChange={(event) =>
                              updateScheduleDay(index, {
                                targetFemaleKm:
                                  event.target.value === ""
                                    ? null
                                    : Number(event.target.value),
                              })
                            }
                            className="mt-1.5 w-full rounded-md border border-kmutt-border bg-[#111619] px-2.5 py-2 text-sm font-bold text-white outline-none focus:border-pink-400 disabled:cursor-not-allowed disabled:opacity-40"
                          />
                        </label>
                      </div>
                      <p className="text-[10px] text-gray-500">
                        {item.isRest
                          ? "วันพักไม่นับเป็นวันฝึกและไม่นำระยะเป้าหมายมาคำนวณ"
                          : "ตัวเลขนี้ใช้คำนวณเท่านั้น ข้อความโปรแกรมเป็นคำอธิบาย"}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-400">
                  จับคู่ชื่อเล่นนักกีฬา กับชื่อบน Strava และสามารถแก้ไขระยะทางหรือครั้งได้โดยตรง
                </p>
                <button
                  onClick={handleAddAthlete}
                  className="flex items-center gap-1 px-3 py-1.5 bg-kmutt-orange hover:bg-kmutt-orangeLight text-white rounded-lg text-xs font-semibold transition"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>เพิ่มนักกีฬา</span>
                </button>
              </div>

              <div className="border border-kmutt-border rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-black/30 border-b border-kmutt-border text-gray-400">
                    <tr>
                      <th className="py-2.5 px-3">ชื่อเล่น</th>
                      <th className="py-2.5 px-3">ชื่อ Strava</th>
                      <th className="py-2.5 px-3">เพศ</th>
                      <th className="py-2.5 px-3">ระยะ (กม.)</th>
                      <th className="py-2.5 px-3">ครั้ง</th>
                      <th className="py-2.5 px-3 text-center">เข้าคลับ</th>
                      <th className="py-2.5 px-3 text-center">ลบ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-kmutt-border/60">
                    {editAthletes.map((athlete, idx) => (
                      <tr key={athlete.id} className="hover:bg-white/5">
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={athlete.nickname}
                            onChange={(e) => {
                              const updated = [...editAthletes];
                              updated[idx].nickname = e.target.value;
                              setEditAthletes(updated);
                            }}
                            className="bg-[#111619] border border-kmutt-border rounded px-2 py-1 text-white w-24"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={athlete.stravaName}
                            onChange={(e) => {
                              const updated = [...editAthletes];
                              updated[idx].stravaName = e.target.value;
                              setEditAthletes(updated);
                            }}
                            className="bg-[#111619] border border-kmutt-border rounded px-2 py-1 text-gray-300 w-36"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <select
                            value={athlete.gender}
                            onChange={(e) => {
                              const updated = [...editAthletes];
                              updated[idx].gender = e.target.value as "M" | "F";
                              setEditAthletes(updated);
                            }}
                            className="bg-[#111619] border border-kmutt-border rounded px-2 py-1 text-white"
                          >
                            <option value="M">ชาย</option>
                            <option value="F">หญิง</option>
                          </select>
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="number"
                            step="0.1"
                            value={athlete.distanceKm}
                            onChange={(e) => {
                              const updated = [...editAthletes];
                              updated[idx].distanceKm =
                                parseFloat(e.target.value) || 0;
                              setEditAthletes(updated);
                            }}
                            className="bg-[#111619] border border-kmutt-border rounded px-2 py-1 text-white w-20"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="number"
                            value={athlete.runsCount}
                            onChange={(e) => {
                              const updated = [...editAthletes];
                              updated[idx].runsCount =
                                parseInt(e.target.value) || 0;
                              setEditAthletes(updated);
                            }}
                            className="bg-[#111619] border border-kmutt-border rounded px-2 py-1 text-white w-16"
                          />
                        </td>
                        <td className="py-2 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={athlete.inClub}
                            onChange={(e) => {
                              const updated = [...editAthletes];
                              updated[idx].inClub = e.target.checked;
                              setEditAthletes(updated);
                            }}
                          />
                        </td>
                        <td className="py-2 px-3 text-center">
                          <button
                            onClick={() => handleRemoveAthlete(athlete.id)}
                            className="text-red-400 hover:text-red-300 p-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-kmutt-border bg-black/40">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-400 hover:text-white transition"
          >
            ยกเลิก
          </button>
          <button
            onClick={handleSaveAll}
            disabled={saving}
            className="flex items-center gap-1.5 px-5 py-2 bg-kmutt-orange hover:bg-kmutt-orangeLight text-white rounded-xl text-xs font-bold transition shadow-lg shadow-kmutt-orange/20"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? "กำลังบันทึก..." : "บันทึกข้อมูล"}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
