import { Athlete, EvaluatedAthlete, ProgramConfig, TrainingStatus } from "@/types";
import { getWeeklyTargetKm } from "@/utils/program";

export function evaluateAthletes(
  athletes: Athlete[],
  program: ProgramConfig
): {
  rankedAthletes: EvaluatedAthlete[];
  notInClub: Athlete[];
  totalTeamKm: number;
  completedCount: number;
  totalAthletesCount: number;
} {
  const inClubAthletes = athletes.filter((a) => a.inClub);
  const notInClub = athletes.filter((a) => !a.inClub);
  const programTrainingDays = program.schedule.filter((day) => !day.isRest).length;
  const fullMinRuns = programTrainingDays;
  const fullMinPercent = program.criteria.fullMinPercent ?? 90;
  const almostMinPercent = program.criteria.almostMinPercent ?? 65;

  const evaluatedAthletes: EvaluatedAthlete[] = inClubAthletes.map((athlete) => {
    const scheduledTrainingDayIndexes = athlete.trainingDayIndexes
      ? new Set(
          athlete.trainingDayIndexes.filter(
            (dayIndex) =>
              Number.isInteger(dayIndex) &&
              dayIndex >= 0 &&
              dayIndex < program.schedule.length &&
              !program.schedule[dayIndex].isRest
          )
        )
      : null;
    const trainingDays =
      scheduledTrainingDayIndexes?.size ??
      athlete.trainingDays ??
      athlete.runsCount;
    const targetKm = getWeeklyTargetKm(program.schedule, athlete.gender);
    const rawPercent =
      targetKm !== null && targetKm > 0
        ? (athlete.distanceKm / targetKm) * 100
        : null;
    const percent = rawPercent === null ? null : Math.round(rawPercent);
    const almostMinRuns = program.criteria.almostMinRuns;
    const fullCriteriaMet =
      rawPercent !== null &&
      trainingDays >= fullMinRuns &&
      rawPercent >= fullMinPercent;
    const almostCriteriaMet =
      rawPercent !== null &&
      trainingDays >= almostMinRuns &&
      rawPercent >= almostMinPercent;
    const missedAtMostOneDay =
      programTrainingDays > 0 &&
      trainingDays >= programTrainingDays - 1;

    let status: TrainingStatus = "incomplete";
    let statusReason = "";

    if (targetKm === null) {
      statusReason = `ยังไม่สามารถคำนวณได้: ยังไม่ได้กำหนดระยะเป้าหมาย${
        athlete.gender === "F" ? "หญิง" : "ชาย"
      }ครบทุกวันฝึก`;
    } else if (programTrainingDays === 0) {
      statusReason = "ยังไม่สามารถคำนวณได้: สัปดาห์นี้ไม่มีวันฝึกตามโปรแกรม";
    } else if (fullCriteriaMet) {
      status = "completed";
      statusReason = `ครบทั้งระยะทาง (${percent}% / เกณฑ์ ${fullMinPercent}%) และวันซ้อม (${trainingDays}/${programTrainingDays} วัน)`;
    } else if (
      almostCriteriaMet ||
      (rawPercent !== null && rawPercent >= 100 && missedAtMostOneDay)
    ) {
      status = "almost";
      if (rawPercent !== null && rawPercent >= 100 && missedAtMostOneDay) {
        const missedDays = Math.max(0, programTrainingDays - trainingDays);
        statusReason =
          missedDays > 0
            ? `ขาดวันซ้อม ${missedDays} วัน (ทำได้ ${trainingDays}/${programTrainingDays} วัน) แม้ระยะทางจะครบ (${percent ?? 0}%)`
            : `ระยะทางครบ (${percent ?? 0}%) และวันซ้อมครบ (${trainingDays}/${programTrainingDays} วัน)`;
      } else {
        const remainingFullCriteria: string[] = [];
        if (trainingDays < fullMinRuns) {
          remainingFullCriteria.push(
            `ขาดวันซ้อม ${fullMinRuns - trainingDays} วันถึงเกณฑ์ครบ`
          );
        }
        if (percent !== null && percent < fullMinPercent) {
          const missingKm = Math.max(
            0,
            (targetKm * fullMinPercent) / 100 - athlete.distanceKm
          );
          remainingFullCriteria.push(
            `ขาดระยะทางอีก ${missingKm.toFixed(1)} กม. (${percent}% / ขาดอีก ${fullMinPercent - percent}% ถึงเกณฑ์ครบ)`
          );
        }
        statusReason = `เกือบครบตามเกณฑ์ขั้นต่ำ (${trainingDays}/${programTrainingDays} วัน และ ${percent ?? 0}%) แต่${remainingFullCriteria.join(" และ ")}`;
      }
    } else {
      const reasons: string[] = [];
      if (trainingDays < almostMinRuns) {
        reasons.push(
          `ขาดวันซ้อม ${almostMinRuns - trainingDays} วันถึงเกณฑ์เกือบครบ (ทำได้ ${trainingDays}/${programTrainingDays} วัน)`
        );
      }
      const percentTarget =
        percent !== null && percent < almostMinPercent
          ? almostMinPercent
          : fullMinPercent;
      if (percent !== null && percent < percentTarget) {
        const missingKm = Math.max(
          0,
          (targetKm * percentTarget) / 100 - athlete.distanceKm
        );
        reasons.push(
          `ขาดระยะทางอีก ${missingKm.toFixed(1)} กม. (${percent}% / ขาดอีก ${percentTarget - percent}% ถึงเกณฑ์${percentTarget === fullMinPercent ? "ครบ" : "เกือบครบ"})`
        );
      }
      statusReason = `ยังไม่ครบ: ${reasons.join(" และ ")}`;
    }

    return {
      ...athlete,
      trainingDays,
      rank: 0,
      targetKm,
      programTrainingDays,
      percent,
      status,
      statusReason,
    };
  });

  const statusPriority: Record<TrainingStatus, number> = {
    completed: 0,
    almost: 1,
    incomplete: 2,
  };
  const rankedAthletes = evaluatedAthletes
    .sort((a, b) => {
      if (a.isSynced !== b.isSynced) {
        return a.isSynced === false ? 1 : -1;
      }
      if (a.isSynced === false) return 0;
      if (a.status !== b.status) {
        return statusPriority[a.status] - statusPriority[b.status];
      }
      return (
        b.distanceKm - a.distanceKm ||
        (b.trainingDays ?? b.runsCount) - (a.trainingDays ?? a.runsCount)
      );
    })
    .map((athlete, index) => ({
      ...athlete,
      rank: athlete.isSynced === false ? 0 : index + 1,
    }));

  const totalTeamKm = Number(
    rankedAthletes
      .filter((athlete) => athlete.isSynced !== false)
      .reduce((acc, curr) => acc + (curr.distanceKm || 0), 0)
      .toFixed(1)
  );

  const syncedAthletes = rankedAthletes.filter((athlete) => athlete.isSynced !== false);
  const completedCount = syncedAthletes.filter((a) => a.status === "completed").length;

  return {
    rankedAthletes,
    notInClub,
    totalTeamKm,
    completedCount,
    totalAthletesCount: syncedAthletes.length,
  };
}
