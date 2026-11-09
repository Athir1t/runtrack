import { Athlete, EvaluatedAthlete, ProgramConfig, TrainingStatus } from "@/types";

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

  // Show synced athletes first, ordered by weekly distance and training days.
  const sorted = [...inClubAthletes].sort((a, b) => {
    if (a.isSynced !== b.isSynced) {
      return a.isSynced ? -1 : 1;
    }
    if (b.distanceKm !== a.distanceKm) {
      return b.distanceKm - a.distanceKm;
    }
    return (b.trainingDays ?? b.runsCount) - (a.trainingDays ?? a.runsCount);
  });

  const rankedAthletes: EvaluatedAthlete[] = sorted.map((athlete, index) => {
    const trainingDays = athlete.trainingDays ?? athlete.runsCount;
    const programTrainingDays = program.schedule.filter((day) => !day.isRest).length;
    const targetKm = athlete.gender === "F" ? program.targetFemaleKm : program.targetMaleKm;
    const rawPercent = targetKm > 0 ? (athlete.distanceKm / targetKm) * 100 : 0;
    const percent = Math.round(rawPercent);

    let status: TrainingStatus = "incomplete";

    if (
      trainingDays >= program.criteria.fullMinRuns &&
      percent >= program.criteria.fullMinPercent
    ) {
      status = "completed";
    } else if (
      trainingDays >= program.criteria.almostMinRuns &&
      percent >= program.criteria.almostMinPercent
    ) {
      status = "almost";
    } else {
      status = "incomplete";
    }

    return {
      ...athlete,
      rank: athlete.isSynced === false ? 0 : index + 1,
      targetKm,
      programTrainingDays,
      percent,
      status,
    };
  });

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
