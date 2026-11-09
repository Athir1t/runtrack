import { DaySchedule } from "@/types";

export type WorkoutType = "rest" | "race" | "easy" | "interval" | "tempo" | "long";

export function getWorkoutType(
  schedule: Pick<DaySchedule, "title" | "detail" | "isRest" | "isRace">
): WorkoutType {
  if (schedule.isRest) return "rest";
  if (schedule.isRace) return "race";

  const description = `${schedule.title} ${schedule.detail || ""}`;
  if (/tempo/i.test(description)) return "tempo";
  if (/interval|repeat|repetition|sets?|×|x\s*\d|400\s*m|800\s*m|1000\s*m|(?:\d+)\s*เมตร/i.test(description)) {
    return "interval";
  }
  if (/long\s*run|long|(?:ระยะ)?ไกล|LSD/i.test(description)) return "long";
  if (/jog|easy|recovery|วิ่งเบา|จ๊อก/i.test(description)) return "easy";
  return "easy";
}

export const workoutStyles: Record<
  WorkoutType,
  { card: string; badge: string; accent: string }
> = {
  rest: {
    card: "bg-[#14181c] border-kmutt-border/60",
    badge: "bg-kmutt-border text-gray-400",
    accent: "text-gray-400",
  },
  race: {
    card: "bg-kmutt-orange/10 border-kmutt-orange/40",
    badge: "bg-kmutt-orange text-white",
    accent: "text-kmutt-orange",
  },
  easy: {
    card: "bg-blue-500/10 border-blue-500/40",
    badge: "bg-blue-500/20 text-blue-300",
    accent: "text-blue-300",
  },
  interval: {
    card: "bg-red-500/10 border-red-500/40",
    badge: "bg-red-500/20 text-red-300",
    accent: "text-red-300",
  },
  tempo: {
    card: "bg-yellow-500/10 border-yellow-500/40",
    badge: "bg-yellow-500/20 text-yellow-300",
    accent: "text-yellow-300",
  },
  long: {
    card: "bg-green-500/10 border-green-500/40",
    badge: "bg-green-500/20 text-green-300",
    accent: "text-green-300",
  },
};
