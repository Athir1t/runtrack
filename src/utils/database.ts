import { Pool, PoolClient } from "pg";
import defaultAthletes from "@/data/athletes.json";
import defaultProgram from "@/data/program.json";
import defaultWeeklyPrograms from "@/data/program-weeks.json";
import { Athlete, ProgramConfig, StravaActivity } from "@/types";
import { withDerivedProgramTargets } from "@/utils/program";

export interface StoredStravaActivity extends StravaActivity {
  athleteId: string;
  athleteName: string;
  averageHeartrate?: number;
  laps: StravaLap[];
  isIntervalDay: boolean;
  source?: "strava" | "manual";
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

export interface StravaTokenData {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

export interface AthleteStravaConnection {
  athleteId: string;
  stravaAthleteId: string;
  athleteName: string;
}

export interface WeeklyAthleteActivitySummary {
  athleteId: string;
  distanceKm: number;
  runsCount: number;
  activityDates: string[];
  validActivityDates: string[];
}

export interface AllWeeklyAthleteActivitySummary
  extends WeeklyAthleteActivitySummary {
  weekStart: string;
}

const globalForPostgres = globalThis as typeof globalThis & {
  runTrackPool?: Pool;
  runTrackSchema?: Promise<void>;
};

function getPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not configured. Add the PostgreSQL connection string to .env.local and restart Next.js."
    );
  }

  if (!globalForPostgres.runTrackPool) {
    globalForPostgres.runTrackPool = new Pool({
      connectionString,
      max: 3,
      connectionTimeoutMillis: 5000,
    });
  }

  return globalForPostgres.runTrackPool;
}

async function seedRows(client: PoolClient): Promise<void> {
  const athletes = (defaultAthletes as Athlete[]).map((athlete) => ({
    id: athlete.id,
    nickname: athlete.nickname,
    strava_name: athlete.stravaName,
    gender: athlete.gender,
    distance_km: athlete.distanceKm,
    runs_count: athlete.runsCount,
    in_club: athlete.inClub,
    avatar_url: athlete.avatarUrl || null,
  }));
  await client.query(
    `INSERT INTO athletes
      (id, nickname, strava_name, gender, distance_km, runs_count, in_club, avatar_url)
     SELECT id, nickname, strava_name, gender, distance_km,
            runs_count, in_club, avatar_url
     FROM jsonb_to_recordset($1::jsonb) AS seed(
       id text, nickname text, strava_name text, gender text,
       distance_km numeric, runs_count integer, in_club boolean, avatar_url text
     )
     ON CONFLICT (id) DO NOTHING`,
    [JSON.stringify(athletes)]
  );

  const programs = {
    [(defaultProgram as ProgramConfig).weekStartDate]: defaultProgram,
    ...(defaultWeeklyPrograms as Record<string, ProgramConfig>),
  };
  const weeklyPrograms = Object.entries(programs).map(([weekStart, program]) => ({
    week_start: weekStart,
    program: { ...program, weekStartDate: weekStart },
  }));
  await client.query(
    `INSERT INTO weekly_programs (week_start, program)
     SELECT week_start::date, program
     FROM jsonb_to_recordset($1::jsonb) AS seed(
       week_start text, program jsonb
     )
     ON CONFLICT (week_start) DO NOTHING`,
    [JSON.stringify(weeklyPrograms)]
  );
}

async function migrateLegacyProgramDayTargets(client: PoolClient): Promise<void> {
  const defaultPrograms: Record<string, ProgramConfig> = {
    [(defaultProgram as ProgramConfig).weekStartDate]: defaultProgram as ProgramConfig,
    ...(defaultWeeklyPrograms as Record<string, ProgramConfig>),
  };

  for (const [weekStart, defaultWeek] of Object.entries(defaultPrograms)) {
    const result = await client.query<{ program: ProgramConfig }>(
      "SELECT program FROM weekly_programs WHERE week_start = $1::date",
      [weekStart]
    );
    const savedProgram = result.rows[0]?.program;
    if (!savedProgram) continue;

    const matchesDefaultSchedule =
      savedProgram.schedule.length === defaultWeek.schedule.length &&
      savedProgram.schedule.every(
        (day, index) =>
          day.day === defaultWeek.schedule[index].day &&
          day.title === defaultWeek.schedule[index].title
      );
    const hasSavedTargets = savedProgram.schedule.some(
      (day) =>
          !day.isRest &&
          (day.targetMaleKm !== undefined || day.targetFemaleKm !== undefined)
      );

    if (matchesDefaultSchedule && !hasSavedTargets) {
      for (const [dayIndex, day] of defaultWeek.schedule.entries()) {
        await client.query(
          `UPDATE weekly_program_days
           SET target_male_km = $3,
               target_female_km = $4,
               targets_initialized = TRUE
           WHERE week_start = $1::date
             AND day_index = $2
             AND targets_initialized = FALSE`,
          [
            weekStart,
            dayIndex,
            day.targetMaleKm ?? null,
            day.targetFemaleKm ?? null,
          ]
        );
      }
    } else {
      await client.query(
        `UPDATE weekly_program_days
         SET targets_initialized = TRUE
         WHERE week_start = $1::date AND targets_initialized = FALSE`,
        [weekStart]
      );
    }
  }
  await client.query(
    `UPDATE weekly_program_days
     SET targets_initialized = TRUE
     WHERE targets_initialized = FALSE`
  );
}

async function migrateWeekTwoRestDay(client: PoolClient): Promise<void> {
  const migrationId = "2026-11-09-add-sunday-rest";
  await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
    migrationId,
  ]);
  const applied = await client.query(
    "SELECT 1 FROM run_track_migrations WHERE migration_id = $1",
    [migrationId]
  );
  if (applied.rowCount) return;

  const weekStart = "2026-11-09";
  const defaultWeek = (defaultWeeklyPrograms as Record<string, ProgramConfig>)[
    weekStart
  ];
  const savedResult = await client.query<{ program: ProgramConfig }>(
    "SELECT program FROM weekly_programs WHERE week_start = $1::date",
    [weekStart]
  );
  const savedProgram = savedResult.rows[0]?.program;
  const legacySunday = savedProgram?.schedule[6];
  const matchesLegacySchedule =
    savedProgram?.schedule.length === defaultWeek.schedule.length &&
    savedProgram.schedule.every(
      (day, index) =>
        day.day === defaultWeek.schedule[index].day &&
        (index === 6
          ? day.title === "แข่ง 5 กม." &&
            day.isRace === true &&
            day.targetMaleKm === 8 &&
            day.targetFemaleKm === 7
          : day.title === defaultWeek.schedule[index].title)
    );

  if (savedProgram && legacySunday && matchesLegacySchedule) {
    const updatedProgram = withDerivedProgramTargets({
      ...savedProgram,
      schedule: savedProgram.schedule.map((day, index) =>
        index === 6 ? defaultWeek.schedule[6] : day
      ),
    });
    const restDay = defaultWeek.schedule[6];
    await client.query(
      `UPDATE weekly_program_days
       SET title = $3, subtitle = $4, detail = $5, is_rest = TRUE,
           is_race = FALSE, target_male_km = $6, target_female_km = $7,
           targets_initialized = TRUE
       WHERE week_start = $1::date AND day_index = $2`,
      [
        weekStart,
        6,
        restDay.title,
        restDay.subtitle ?? null,
        restDay.detail ?? null,
        restDay.targetMaleKm ?? null,
        restDay.targetFemaleKm ?? null,
      ]
    );
    await client.query(
      `UPDATE weekly_programs
       SET program = $2::jsonb, updated_at = NOW()
       WHERE week_start = $1::date`,
      [weekStart, JSON.stringify(updatedProgram)]
    );
  }

  await client.query(
    "INSERT INTO run_track_migrations (migration_id) VALUES ($1) ON CONFLICT DO NOTHING",
    [migrationId]
  );
}

async function initializeSchema(): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`
      CREATE TABLE IF NOT EXISTS athletes (
        id TEXT PRIMARY KEY,
        nickname TEXT NOT NULL,
        strava_name TEXT NOT NULL DEFAULT '',
        gender TEXT NOT NULL CHECK (gender IN ('M', 'F')),
        distance_km NUMERIC(10, 2) NOT NULL DEFAULT 0,
        runs_count INTEGER NOT NULL DEFAULT 0,
        in_club BOOLEAN NOT NULL DEFAULT TRUE,
        avatar_url TEXT,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS weekly_programs (
        week_start DATE PRIMARY KEY,
        program JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS run_track_migrations (
        migration_id TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS weekly_program_days (
        week_start DATE NOT NULL REFERENCES weekly_programs(week_start) ON DELETE CASCADE,
        day_index SMALLINT NOT NULL CHECK (day_index BETWEEN 0 AND 6),
        day TEXT NOT NULL,
        title TEXT NOT NULL,
        subtitle TEXT,
        detail TEXT,
        is_rest BOOLEAN NOT NULL DEFAULT FALSE,
        is_race BOOLEAN NOT NULL DEFAULT FALSE,
        target_male_km NUMERIC(10, 2),
        target_female_km NUMERIC(10, 2),
        targets_initialized BOOLEAN NOT NULL DEFAULT FALSE,
        PRIMARY KEY (week_start, day_index)
      );
      ALTER TABLE weekly_program_days
      ADD COLUMN IF NOT EXISTS targets_initialized BOOLEAN NOT NULL DEFAULT FALSE;

      CREATE TABLE IF NOT EXISTS strava_connections (
        singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
        athlete_id TEXT NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
        athlete_name TEXT NOT NULL,
        connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS strava_oauth_tokens (
        singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
        access_token TEXT NOT NULL,
        refresh_token TEXT NOT NULL,
        expires_at BIGINT NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS athlete_strava_connections (
        athlete_id TEXT PRIMARY KEY REFERENCES athletes(id) ON DELETE CASCADE,
        strava_athlete_id BIGINT NOT NULL UNIQUE,
        athlete_name TEXT NOT NULL,
        connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS athlete_strava_tokens (
        athlete_id TEXT PRIMARY KEY REFERENCES athletes(id) ON DELETE CASCADE,
        access_token TEXT NOT NULL,
        refresh_token TEXT NOT NULL,
        expires_at BIGINT NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS manual_activities (
        id BIGSERIAL PRIMARY KEY,
        athlete_id TEXT NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
        week_start DATE NOT NULL,
        activity_name TEXT NOT NULL,
        distance_km NUMERIC(10, 3) NOT NULL,
        moving_time_seconds INTEGER NOT NULL,
        start_date_local TEXT NOT NULL,
        average_heartrate NUMERIC(6, 2),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS weekly_activities (
        activity_id BIGINT PRIMARY KEY,
        athlete_id TEXT NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
        week_start DATE NOT NULL,
        activity_name TEXT NOT NULL,
        distance_km NUMERIC(10, 3) NOT NULL DEFAULT 0,
        moving_time_seconds INTEGER NOT NULL DEFAULT 0,
        start_date TIMESTAMPTZ,
        start_date_local TEXT NOT NULL DEFAULT '',
        average_heartrate NUMERIC(6, 2),
        is_interval_day BOOLEAN NOT NULL DEFAULT FALSE,
        laps JSONB NOT NULL DEFAULT '[]'::jsonb,
        synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS weekly_activity_syncs (
        athlete_id TEXT NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
        week_start DATE NOT NULL,
        synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        activity_count INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (athlete_id, week_start)
      );

      CREATE INDEX IF NOT EXISTS weekly_activities_athlete_week_idx
      ON weekly_activities (athlete_id, week_start, start_date_local)
    `);
    await seedRows(client);
    await client.query(`
      INSERT INTO weekly_program_days
        (week_start, day_index, day, title, subtitle, detail, is_rest, is_race,
         target_male_km, target_female_km, targets_initialized)
      SELECT
        programs.week_start,
        (day_row.ordinality - 1)::smallint,
        day_row.day->>'day',
        day_row.day->>'title',
        NULLIF(day_row.day->>'subtitle', ''),
        NULLIF(day_row.day->>'detail', ''),
        COALESCE((day_row.day->>'isRest')::boolean, FALSE),
        COALESCE((day_row.day->>'isRace')::boolean, FALSE),
        NULLIF(day_row.day->>'targetMaleKm', 'null')::numeric,
        NULLIF(day_row.day->>'targetFemaleKm', 'null')::numeric,
        (day_row.day ? 'targetMaleKm') OR (day_row.day ? 'targetFemaleKm')
      FROM weekly_programs AS programs
      CROSS JOIN LATERAL jsonb_array_elements(
        CASE
          WHEN jsonb_typeof(programs.program->'schedule') = 'array'
          THEN programs.program->'schedule'
          ELSE '[]'::jsonb
        END
      ) WITH ORDINALITY AS day_row(day, ordinality)
      ON CONFLICT (week_start, day_index) DO NOTHING
    `);
    await migrateWeekTwoRestDay(client);
    await migrateLegacyProgramDayTargets(client);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function ensureDatabase(): Promise<Pool> {
  if (!globalForPostgres.runTrackSchema) {
    globalForPostgres.runTrackSchema = initializeSchema().catch((error) => {
      globalForPostgres.runTrackSchema = undefined;
      throw error;
    });
  }
  await globalForPostgres.runTrackSchema;
  return getPool();
}

export async function getAthletes(): Promise<Athlete[]> {
  const pool = await ensureDatabase();
  const result = await pool.query(
    `SELECT id, nickname, strava_name AS "stravaName", gender,
            distance_km AS "distanceKm", runs_count AS "runsCount",
            in_club AS "inClub", avatar_url AS "avatarUrl"
     FROM athletes
     ORDER BY id`
  );
  return result.rows.map((row) => ({
    ...row,
    distanceKm: Number(row.distanceKm),
    runsCount: Number(row.runsCount),
  }));
}

export async function saveAthletes(athletes: Athlete[]): Promise<void> {
  const pool = await ensureDatabase();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM athletes WHERE id <> ALL($1::text[])", [
      athletes.map((athlete) => athlete.id),
    ]);
    for (const athlete of athletes) {
      await client.query(
        `INSERT INTO athletes
          (id, nickname, strava_name, gender, distance_km, runs_count, in_club, avatar_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO UPDATE SET
           nickname = EXCLUDED.nickname,
           strava_name = EXCLUDED.strava_name,
           gender = EXCLUDED.gender,
           distance_km = EXCLUDED.distance_km,
           runs_count = EXCLUDED.runs_count,
           in_club = EXCLUDED.in_club,
           avatar_url = EXCLUDED.avatar_url,
           updated_at = NOW()`,
        [
          athlete.id,
          athlete.nickname,
          athlete.stravaName,
          athlete.gender,
          athlete.distanceKm,
          athlete.runsCount,
          athlete.inClub,
          athlete.avatarUrl || null,
        ]
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function getWeeklyProgram(
  weekStart: string
): Promise<ProgramConfig | null> {
  const pool = await ensureDatabase();
  const result = await pool.query<{ program: ProgramConfig }>(
    "SELECT program FROM weekly_programs WHERE week_start = $1::date",
    [weekStart]
  );
  const savedProgram = result.rows[0]?.program;
  if (!savedProgram) return null;

  const daysResult = await pool.query<{
    day: string;
    title: string;
    subtitle: string | null;
    detail: string | null;
    isRest: boolean;
    isRace: boolean;
    targetMaleKm: string | null;
    targetFemaleKm: string | null;
  }>(
    `SELECT day, title, subtitle, detail, is_rest AS "isRest",
            is_race AS "isRace", target_male_km AS "targetMaleKm",
            target_female_km AS "targetFemaleKm"
     FROM weekly_program_days
     WHERE week_start = $1::date
     ORDER BY day_index`,
    [weekStart]
  );
  const schedule = daysResult.rows.length
    ? daysResult.rows.map((day) => ({
        day: day.day,
        title: day.title,
        subtitle: day.subtitle ?? undefined,
        detail: day.detail ?? undefined,
        isRest: day.isRest,
        isRace: day.isRace,
        targetMaleKm:
          day.targetMaleKm === null ? null : Number(day.targetMaleKm),
        targetFemaleKm:
          day.targetFemaleKm === null ? null : Number(day.targetFemaleKm),
      }))
    : savedProgram.schedule;
  return withDerivedProgramTargets({
    ...savedProgram,
    weekStartDate: weekStart,
    schedule,
  });
}

export async function getWeeklyProgramsThroughDate(
  throughDate: string
): Promise<Array<{ weekStart: string; program: ProgramConfig }>> {
  const pool = await ensureDatabase();
  const result = await pool.query<{
    weekStart: string;
    program: ProgramConfig;
    schedule: ProgramConfig["schedule"];
  }>(
    `SELECT TO_CHAR(programs.week_start, 'YYYY-MM-DD') AS "weekStart",
            programs.program,
            COALESCE(
              JSONB_AGG(
                JSONB_BUILD_OBJECT(
                  'day', days.day,
                  'title', days.title,
                  'subtitle', days.subtitle,
                  'detail', days.detail,
                  'isRest', days.is_rest,
                  'isRace', days.is_race,
                  'targetMaleKm', days.target_male_km,
                  'targetFemaleKm', days.target_female_km
                ) ORDER BY days.day_index
              ) FILTER (WHERE days.day_index IS NOT NULL),
              '[]'::jsonb
            ) AS schedule
     FROM weekly_programs AS programs
     LEFT JOIN weekly_program_days AS days
       ON days.week_start = programs.week_start
     WHERE programs.week_start <= $1::date
     GROUP BY programs.week_start, programs.program
     ORDER BY programs.week_start`,
    [throughDate]
  );
  return result.rows.map((row) => ({
    weekStart: row.weekStart,
    program: withDerivedProgramTargets({
      ...row.program,
      weekStartDate: row.weekStart,
      schedule: row.schedule.length ? row.schedule : row.program.schedule,
    }),
  }));
}

export async function saveWeeklyProgram(
  weekStart: string,
  program: ProgramConfig
): Promise<void> {
  const pool = await ensureDatabase();
  const normalizedProgram = withDerivedProgramTargets({
    ...program,
    weekStartDate: weekStart,
  });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO weekly_programs (week_start, program)
       VALUES ($1::date, $2::jsonb)
       ON CONFLICT (week_start) DO UPDATE SET
         program = EXCLUDED.program,
         updated_at = NOW()`,
      [weekStart, JSON.stringify(normalizedProgram)]
    );
    await client.query(
      "DELETE FROM weekly_program_days WHERE week_start = $1::date",
      [weekStart]
    );
    for (const [dayIndex, day] of normalizedProgram.schedule.entries()) {
      await client.query(
        `INSERT INTO weekly_program_days
          (week_start, day_index, day, title, subtitle, detail, is_rest, is_race,
           target_male_km, target_female_km, targets_initialized)
           VALUES ($1::date, $2, $3, $4, $5, $6, $7, $8, $9, $10, TRUE)`,
        [
          weekStart,
          dayIndex,
          day.day,
          day.title,
          day.subtitle || null,
          day.detail || null,
          Boolean(day.isRest),
          Boolean(day.isRace),
          day.targetMaleKm ?? null,
          day.targetFemaleKm ?? null,
        ]
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function getStravaConnection(): Promise<{
  athleteId: string;
  athleteName: string;
} | null> {
  const pool = await ensureDatabase();
  const result = await pool.query(
    `SELECT athlete_id AS "athleteId", athlete_name AS "athleteName"
     FROM strava_connections WHERE singleton = TRUE`
  );
  return result.rows[0] || null;
}

export async function saveStravaConnection(
  athleteId: string,
  stravaAthleteId: string,
  athleteName: string
): Promise<void> {
  const pool = await ensureDatabase();
  await pool.query(
    `INSERT INTO athlete_strava_connections
      (athlete_id, strava_athlete_id, athlete_name)
     VALUES ($1, $2, $3)
     ON CONFLICT (athlete_id) DO UPDATE SET
       strava_athlete_id = EXCLUDED.strava_athlete_id,
       athlete_name = EXCLUDED.athlete_name,
       connected_at = NOW()`,
    [athleteId, stravaAthleteId, athleteName]
  );
}

export async function getAthleteStravaConnection(
  athleteId: string
): Promise<AthleteStravaConnection | null> {
  const pool = await ensureDatabase();
  const result = await pool.query(
    `SELECT athlete_id AS "athleteId",
            strava_athlete_id AS "stravaAthleteId",
            athlete_name AS "athleteName"
     FROM athlete_strava_connections WHERE athlete_id = $1`,
    [athleteId]
  );
  if (!result.rows[0]) return null;
  return { ...result.rows[0], stravaAthleteId: String(result.rows[0].stravaAthleteId) };
}

export async function getAthleteStravaConnections(): Promise<AthleteStravaConnection[]> {
  const pool = await ensureDatabase();
  const result = await pool.query(
    `SELECT athlete_id AS "athleteId",
            strava_athlete_id AS "stravaAthleteId",
            athlete_name AS "athleteName"
     FROM athlete_strava_connections
     ORDER BY athlete_id`
  );
  return result.rows.map((row) => ({
    ...row,
    stravaAthleteId: String(row.stravaAthleteId),
  }));
}

export async function getAthleteStravaToken(
  athleteId: string
): Promise<StravaTokenData | null> {
  const pool = await ensureDatabase();
  const result = await pool.query(
    `SELECT access_token, refresh_token, expires_at
     FROM athlete_strava_tokens WHERE athlete_id = $1`,
    [athleteId]
  );
  const token = result.rows[0];
  if (!token) return null;
  return {
    access_token: token.access_token,
    refresh_token: token.refresh_token,
    expires_at: Number(token.expires_at),
  };
}

export async function disconnectAthleteFromStrava(
  athleteId: string
): Promise<void> {
  const pool = await ensureDatabase();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM weekly_activities WHERE athlete_id = $1", [
      athleteId,
    ]);
    await client.query(
      "DELETE FROM weekly_activity_syncs WHERE athlete_id = $1",
      [athleteId]
    );
    await client.query(
      "DELETE FROM athlete_strava_tokens WHERE athlete_id = $1",
      [athleteId]
    );
    await client.query(
      "DELETE FROM athlete_strava_connections WHERE athlete_id = $1",
      [athleteId]
    );
    await client.query(
      `UPDATE athletes
       SET strava_name = '', distance_km = 0, runs_count = 0, avatar_url = NULL
       WHERE id = $1`,
      [athleteId]
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function saveAthleteStravaToken(
  athleteId: string,
  token: StravaTokenData
): Promise<void> {
  const pool = await ensureDatabase();
  await pool.query(
    `INSERT INTO athlete_strava_tokens
      (athlete_id, access_token, refresh_token, expires_at)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (athlete_id) DO UPDATE SET
       access_token = EXCLUDED.access_token,
       refresh_token = EXCLUDED.refresh_token,
       expires_at = EXCLUDED.expires_at,
       updated_at = NOW()`,
    [athleteId, token.access_token, token.refresh_token, token.expires_at]
  );
}

export async function getWeeklyActivities(
  athleteId: string,
  weekStart: string
): Promise<StoredStravaActivity[]> {
  const pool = await ensureDatabase();
  const result = await pool.query(
    `SELECT * FROM (
       SELECT activity_id AS id, athlete_id AS "athleteId",
              activity_name AS name, distance_km AS "distanceKm",
              moving_time_seconds AS "movingTimeSeconds",
              start_date AS "startDate", start_date_local AS "startDateLocal",
              average_heartrate AS "averageHeartrate", laps,
              is_interval_day AS "isIntervalDay", 'strava'::text AS source
       FROM weekly_activities
       WHERE athlete_id = $1 AND week_start = $2::date
       UNION ALL
       SELECT -id AS id, athlete_id AS "athleteId",
              activity_name AS name, distance_km AS "distanceKm",
              moving_time_seconds AS "movingTimeSeconds",
              NULL::timestamptz AS "startDate",
              start_date_local AS "startDateLocal",
              average_heartrate AS "averageHeartrate",
              '[]'::jsonb AS laps, FALSE AS "isIntervalDay",
              'manual'::text AS source
       FROM manual_activities
       WHERE athlete_id = $1 AND week_start = $2::date
     ) activities
     ORDER BY "startDateLocal"`,
    [athleteId, weekStart]
  );
  return result.rows.map((row) => ({
    ...row,
    id: Number(row.id),
    distanceKm: Number(row.distanceKm),
    movingTimeSeconds: Number(row.movingTimeSeconds),
    averageHeartrate:
      row.averageHeartrate === null ? undefined : Number(row.averageHeartrate),
    laps: row.laps || [],
    source: row.source,
  }));
}

export async function getAllWeeklyActivities(
  weekStart: string
): Promise<StoredStravaActivity[]> {
  const pool = await ensureDatabase();
  const result = await pool.query(
    `SELECT * FROM (
       SELECT activity_id AS id, athlete_id AS "athleteId",
              activity_name AS name, distance_km AS "distanceKm",
              moving_time_seconds AS "movingTimeSeconds",
              start_date AS "startDate", start_date_local AS "startDateLocal",
              average_heartrate AS "averageHeartrate", laps,
              is_interval_day AS "isIntervalDay", 'strava'::text AS source
       FROM weekly_activities WHERE week_start = $1::date
       UNION ALL
       SELECT -id AS id, athlete_id AS "athleteId",
              activity_name AS name, distance_km AS "distanceKm",
              moving_time_seconds AS "movingTimeSeconds",
              NULL::timestamptz AS "startDate",
              start_date_local AS "startDateLocal",
              average_heartrate AS "averageHeartrate",
              '[]'::jsonb AS laps, FALSE AS "isIntervalDay",
              'manual'::text AS source
       FROM manual_activities WHERE week_start = $1::date
     ) activities
     ORDER BY "startDateLocal"`,
    [weekStart]
  );
  return result.rows.map((row) => ({
    ...row,
    id: Number(row.id),
    distanceKm: Number(row.distanceKm),
    movingTimeSeconds: Number(row.movingTimeSeconds),
    averageHeartrate:
      row.averageHeartrate === null ? undefined : Number(row.averageHeartrate),
    laps: row.laps || [],
    source: row.source,
  }));
}

export async function getWeeklyAthleteActivitySummaries(
  weekStart: string
): Promise<WeeklyAthleteActivitySummary[]> {
  const pool = await ensureDatabase();
  const result = await pool.query(
    `SELECT athlete_id AS "athleteId",
            SUM(distance_km)::float8 AS "distanceKm",
            COUNT(*)::int AS "runsCount",
            ARRAY_AGG(DISTINCT LEFT(start_date_local, 10)) AS "activityDates",
            ARRAY_AGG(DISTINCT LEFT(start_date_local, 10))
              FILTER (WHERE distance_km >= 1 AND moving_time_seconds >= 300)
              AS "validActivityDates"
     FROM (
       SELECT athlete_id, distance_km, moving_time_seconds, start_date_local
       FROM weekly_activities WHERE week_start = $1::date
       UNION ALL
       SELECT athlete_id, distance_km, moving_time_seconds, start_date_local
       FROM manual_activities WHERE week_start = $1::date
     ) activities
     GROUP BY athlete_id`,
    [weekStart]
  );
  return result.rows.map((row) => ({
    athleteId: row.athleteId,
    distanceKm: Number(row.distanceKm),
    runsCount: Number(row.runsCount),
    activityDates: row.activityDates || [],
    validActivityDates: row.validActivityDates || [],
  }));
}

export async function getAllWeeklyAthleteActivitySummaries(
  throughDate: string
): Promise<AllWeeklyAthleteActivitySummary[]> {
  const pool = await ensureDatabase();
  const result = await pool.query(
    `SELECT TO_CHAR(week_start, 'YYYY-MM-DD') AS "weekStart",
            athlete_id AS "athleteId",
            SUM(distance_km)::float8 AS "distanceKm",
            COUNT(*)::int AS "runsCount",
            ARRAY_AGG(DISTINCT LEFT(start_date_local, 10)) AS "activityDates",
            ARRAY_AGG(DISTINCT LEFT(start_date_local, 10))
              FILTER (WHERE distance_km >= 1 AND moving_time_seconds >= 300)
              AS "validActivityDates"
     FROM (
       SELECT athlete_id, week_start, distance_km, moving_time_seconds,
              start_date_local
       FROM weekly_activities
       WHERE week_start <= $1::date
       UNION ALL
       SELECT athlete_id, week_start, distance_km, moving_time_seconds,
              start_date_local
       FROM manual_activities
       WHERE week_start <= $1::date
     ) AS activities
     GROUP BY week_start, athlete_id
     ORDER BY week_start, athlete_id`,
    [throughDate]
  );
  return result.rows.map((row) => ({
    ...row,
    distanceKm: Number(row.distanceKm),
    runsCount: Number(row.runsCount),
    activityDates: row.activityDates || [],
    validActivityDates: row.validActivityDates || [],
  }));
}

export async function addManualActivity(input: {
  athleteId: string;
  weekStart: string;
  name: string;
  distanceKm: number;
  movingTimeSeconds: number;
  startDateLocal: string;
  averageHeartrate?: number;
}): Promise<void> {
  const pool = await ensureDatabase();
  await pool.query(
    `INSERT INTO manual_activities
      (athlete_id, week_start, activity_name, distance_km,
       moving_time_seconds, start_date_local, average_heartrate)
     VALUES ($1, $2::date, $3, $4, $5, $6, $7)`,
    [
      input.athleteId,
      input.weekStart,
      input.name,
      input.distanceKm,
      input.movingTimeSeconds,
      input.startDateLocal,
      input.averageHeartrate ?? null,
    ]
  );
}

export async function getRecentAthleteActivities(
  athleteId: string
): Promise<StoredStravaActivity[]> {
  const pool = await ensureDatabase();
  const result = await pool.query(
    `SELECT * FROM (
       SELECT activity_id AS id, athlete_id AS "athleteId",
              activity_name AS name, distance_km AS "distanceKm",
              moving_time_seconds AS "movingTimeSeconds",
              start_date AS "startDate", start_date_local AS "startDateLocal",
              average_heartrate AS "averageHeartrate", laps,
              is_interval_day AS "isIntervalDay", 'strava'::text AS source
       FROM weekly_activities WHERE athlete_id = $1
       UNION ALL
       SELECT -id AS id, athlete_id AS "athleteId",
              activity_name AS name, distance_km AS "distanceKm",
              moving_time_seconds AS "movingTimeSeconds",
              NULL::timestamptz AS "startDate",
              start_date_local AS "startDateLocal",
              average_heartrate AS "averageHeartrate",
              '[]'::jsonb AS laps, FALSE AS "isIntervalDay",
              'manual'::text AS source
       FROM manual_activities WHERE athlete_id = $1
     ) activities
     ORDER BY "startDateLocal" DESC
     LIMIT 200`,
    [athleteId]
  );
  return result.rows.map((row) => ({
    ...row,
    id: Number(row.id),
    distanceKm: Number(row.distanceKm),
    movingTimeSeconds: Number(row.movingTimeSeconds),
    averageHeartrate:
      row.averageHeartrate === null ? undefined : Number(row.averageHeartrate),
    laps: row.laps || [],
    source: row.source,
  }));
}

export async function getWeeklyActivitySync(
  athleteId: string,
  weekStart: string
): Promise<{ activityCount: number; syncedAt: string } | null> {
  const pool = await ensureDatabase();
  const result = await pool.query(
    `SELECT activity_count AS "activityCount", synced_at AS "syncedAt"
     FROM weekly_activity_syncs
     WHERE athlete_id = $1 AND week_start = $2::date`,
    [athleteId, weekStart]
  );
  if (!result.rows[0]) return null;
  return {
    activityCount: Number(result.rows[0].activityCount),
    syncedAt: result.rows[0].syncedAt,
  };
}

export async function saveWeeklyActivities(
  athleteId: string,
  weekStart: string,
  activities: StoredStravaActivity[]
): Promise<void> {
  const pool = await ensureDatabase();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const activity of activities) {
      await client.query(
        `INSERT INTO weekly_activities
          (activity_id, athlete_id, week_start, activity_name, distance_km,
           moving_time_seconds, start_date, start_date_local, average_heartrate,
           is_interval_day, laps, synced_at)
         VALUES ($1, $2, $3::date, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, NOW())
         ON CONFLICT (activity_id) DO UPDATE SET
           athlete_id = EXCLUDED.athlete_id,
           week_start = EXCLUDED.week_start,
           activity_name = EXCLUDED.activity_name,
           distance_km = EXCLUDED.distance_km,
           moving_time_seconds = EXCLUDED.moving_time_seconds,
           start_date = EXCLUDED.start_date,
           start_date_local = EXCLUDED.start_date_local,
           average_heartrate = EXCLUDED.average_heartrate,
           is_interval_day = EXCLUDED.is_interval_day,
           laps = CASE
             WHEN EXCLUDED.laps = '[]'::jsonb
              AND weekly_activities.laps <> '[]'::jsonb
             THEN weekly_activities.laps
             ELSE EXCLUDED.laps
           END,
           synced_at = NOW()`,
        [
          activity.id,
          athleteId,
          weekStart,
          activity.name,
          activity.distanceKm,
          activity.movingTimeSeconds,
          activity.startDate || null,
          activity.startDateLocal || "",
          activity.averageHeartrate ?? null,
          activity.isIntervalDay,
          JSON.stringify(activity.laps),
        ]
      );
    }
    await client.query(
      `DELETE FROM weekly_activities
       WHERE athlete_id = $1 AND week_start = $2::date
         AND activity_id <> ALL($3::bigint[])`,
      [athleteId, weekStart, activities.map((activity) => activity.id)]
    );
    await client.query(
      `INSERT INTO weekly_activity_syncs (athlete_id, week_start, activity_count)
       VALUES ($1, $2::date, $3)
       ON CONFLICT (athlete_id, week_start) DO UPDATE SET
         synced_at = NOW(),
         activity_count = EXCLUDED.activity_count`,
      [athleteId, weekStart, activities.length]
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
