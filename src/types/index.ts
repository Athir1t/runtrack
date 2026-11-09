export interface Athlete {
  id: string;
  nickname: string;
  stravaName: string;
  gender: "M" | "F";
  distanceKm: number;
  runsCount: number;
  trainingDays?: number;
  isSynced?: boolean;
  inClub: boolean;
  avatarUrl?: string;
}

export interface StravaActivity {
  id: number;
  name: string;
  distanceKm: number;
  movingTimeSeconds: number;
  startDate: string;
  startDateLocal?: string;
  averageHeartrate?: number;
  isIntervalDay?: boolean;
  laps?: StravaLap[];
}

export interface StravaLap {
  id?: number;
  lapIndex: number;
  name?: string;
  distanceKm: number;
  movingTimeSeconds: number;
  elapsedTimeSeconds: number;
  startDate: string;
  averageSpeedMps?: number;
  averageHeartrate?: number;
  maxHeartrate?: number;
}

export interface DaySchedule {
  day: string;
  title: string;
  subtitle?: string;
  detail?: string;
  isRest?: boolean;
  isRace?: boolean;
}

export interface ProgramConfig {
  weekTitle: string;
  weekStartDate: string;
  targetMaleKm: number;
  targetFemaleKm: number;
  criteria: {
    fullMinRuns: number;
    fullMinPercent: number;
    almostMinRuns: number;
    almostMinPercent: number;
  };
  schedule: DaySchedule[];
}

export type TrainingStatus = "completed" | "almost" | "incomplete";

export interface EvaluatedAthlete extends Athlete {
  rank: number;
  targetKm: number;
  programTrainingDays: number;
  percent: number;
  status: TrainingStatus;
}
