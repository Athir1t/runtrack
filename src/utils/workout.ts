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
    card: "bg-kmutt-dark border-kmutt-border/60",
    badge: "bg-kmutt-border text-gray-400",
    accent: "text-gray-400",
  },
  race: {
    card: "bg-kmutt-orange/10 border-kmutt-orange/40",
    badge: "bg-kmutt-orange text-white",
    accent: "text-kmutt-orange",
  },
  easy: {
    card: "bg-kmutt-card border-kmutt-border",
    badge: "bg-kmutt-orange/10 text-kmutt-orange",
    accent: "text-kmutt-orange",
  },
  interval: {
    card: "bg-kmutt-card border-kmutt-border",
    badge: "bg-kmutt-orange/10 text-kmutt-orange",
    accent: "text-kmutt-orange",
  },
  tempo: {
    card: "bg-kmutt-card border-kmutt-border",
    badge: "bg-kmutt-orange/10 text-kmutt-orange",
    accent: "text-kmutt-orange",
  },
  long: {
    card: "bg-kmutt-card border-kmutt-border",
    badge: "bg-kmutt-orange/10 text-kmutt-orange",
    accent: "text-kmutt-orange",
  },
};
