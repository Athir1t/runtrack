"use client";

import React, { useEffect, useState } from "react";
import { ProgramConfig, Athlete } from "@/types";
import { X, Plus, Trash2, Save, UserPlus } from "lucide-react";

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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-black/20 p-4 rounded-xl border border-kmutt-border">
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
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1">
                    เป้าหมายระยะ ชาย (กม.)
                  </label>
                  <input
                    type="number"
                    value={editProgram.targetMaleKm}
                    onChange={(e) =>
                      setEditProgram({
                        ...editProgram,
                        targetMaleKm: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full bg-[#111619] border border-kmutt-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-kmutt-orange"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1">
                    เป้าหมายระยะ หญิง (กม.)
                  </label>
                  <input
                    type="number"
                    value={editProgram.targetFemaleKm}
                    onChange={(e) =>
                      setEditProgram({
                        ...editProgram,
                        targetFemaleKm: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full bg-[#111619] border border-kmutt-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-kmutt-orange"
                  />
                </div>
              </div>

              {/* Day Schedules */}
              <div>
                <h3 className="text-sm font-bold text-white mb-3">
                  โปรแกรมรายวัน (จันทร์ - อาทิตย์)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {editProgram.schedule.map((item, index) => (
                    <div
                      key={index}
                      className="bg-black/20 border border-kmutt-border p-3 rounded-xl flex flex-col gap-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-kmutt-orange text-sm">
                          วัน{item.day}
                        </span>
                        <div className="flex items-center gap-3 text-xs">
                          <label className="flex items-center gap-1 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={item.isRest || false}
                              onChange={(e) => {
                                const newSched = [...editProgram.schedule];
                                newSched[index].isRest = e.target.checked;
                                setEditProgram({
                                  ...editProgram,
                                  schedule: newSched,
                                });
                              }}
                            />
                            <span>พัก (Rest)</span>
                          </label>
                          <label className="flex items-center gap-1 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={item.isRace || false}
                              onChange={(e) => {
                                const newSched = [...editProgram.schedule];
                                newSched[index].isRace = e.target.checked;
                                setEditProgram({
                                  ...editProgram,
                                  schedule: newSched,
                                });
                              }}
                            />
                            <span>แข่ง (Race)</span>
                          </label>
                        </div>
                      </div>
                      <input
                        type="text"
                        placeholder="ข้อความโปรแกรม (เช่น 400 ม. x 15)"
                        value={item.title}
                        onChange={(e) => {
                          const newSched = [...editProgram.schedule];
                          newSched[index].title = e.target.value;
                          setEditProgram({
                            ...editProgram,
                            schedule: newSched,
                          });
                        }}
                        className="bg-[#111619] border border-kmutt-border rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-kmutt-orange"
                      />
                      <input
                        type="text"
                        placeholder="หมายเหตุย่อย (เช่น ญ 10-12)"
                        value={item.subtitle || ""}
                        onChange={(e) => {
                          const newSched = [...editProgram.schedule];
                          newSched[index].subtitle = e.target.value;
                          setEditProgram({
                            ...editProgram,
                            schedule: newSched,
                          });
                        }}
                        className="bg-[#111619] border border-kmutt-border rounded-lg px-3 py-1 text-gray-400 text-xs focus:outline-none focus:border-kmutt-orange"
                      />
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
