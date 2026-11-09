import { Pool, PoolClient } from "pg";
import defaultAthletes from "@/data/athletes.json";
import defaultProgram from "@/data/program.json";
import defaultWeeklyPrograms from "@/data/program-weeks.json";
import { Athlete, ProgramConfig, StravaActivity } from "@/types";

export interface StoredStravaActivity extends StravaActivity {
  athleteId: string;
  athleteName: string;
  averageHeartrate?: number;
  laps: StravaLap[];
  isIntervalDay: boolean;
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
  for (const athlete of defaultAthletes as Athlete[]) {
    await client.query(
      `INSERT INTO athletes
        (id, nickname, strava_name, gender, distance_km, runs_count, in_club, avatar_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO NOTHING`,
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

  const programs = {
    [(defaultProgram as ProgramConfig).weekStartDate]: defaultProgram,
    ...(defaultWeeklyPrograms as Record<string, ProgramConfig>),
  };
  for (const [weekStart, program] of Object.entries(programs)) {
    await client.query(
      `INSERT INTO weekly_programs (week_start, program)
       VALUES ($1::date, $2::jsonb)
       ON CONFLICT (week_start) DO NOTHING`,
      [weekStart, JSON.stringify({ ...program, weekStartDate: weekStart })]
    );
  }
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
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS weekly_programs (
        week_start DATE PRIMARY KEY,
        program JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS strava_connections (
        singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
        athlete_id TEXT NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
        athlete_name TEXT NOT NULL,
        connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS strava_oauth_tokens (
        singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
        access_token TEXT NOT NULL,
        refresh_token TEXT NOT NULL,
        expires_at BIGINT NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`
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
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS weekly_activity_syncs (
        athlete_id TEXT NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
        week_start DATE NOT NULL,
        synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        activity_count INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (athlete_id, week_start)
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS weekly_activities_athlete_week_idx
      ON weekly_activities (athlete_id, week_start, start_date_local)
    `);
    await seedRows(client);
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
  return result.rows[0]?.program || null;
}

export async function saveWeeklyProgram(
  weekStart: string,
  program: ProgramConfig
): Promise<void> {
  const pool = await ensureDatabase();
  await pool.query(
    `INSERT INTO weekly_programs (week_start, program)
     VALUES ($1::date, $2::jsonb)
     ON CONFLICT (week_start) DO UPDATE SET
       program = EXCLUDED.program,
       updated_at = NOW()`,
    [weekStart, JSON.stringify({ ...program, weekStartDate: weekStart })]
  );
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
  athleteName: string
): Promise<void> {
  const pool = await ensureDatabase();
  await pool.query(
    `INSERT INTO strava_connections (singleton, athlete_id, athlete_name)
     VALUES (TRUE, $1, $2)
     ON CONFLICT (singleton) DO UPDATE SET
       athlete_id = EXCLUDED.athlete_id,
       athlete_name = EXCLUDED.athlete_name,
       connected_at = NOW()`,
    [athleteId, athleteName]
  );
}

export async function getStravaToken(): Promise<StravaTokenData | null> {
  const pool = await ensureDatabase();
  const result = await pool.query(
    `SELECT access_token AS "access_token",
            refresh_token AS "refresh_token",
            expires_at AS "expires_at"
     FROM strava_oauth_tokens WHERE singleton = TRUE`
  );
  const token = result.rows[0];
  if (!token) return null;
  return {
    access_token: token.access_token,
    refresh_token: token.refresh_token,
    expires_at: Number(token.expires_at),
  };
}

export async function saveStravaToken(token: StravaTokenData): Promise<void> {
  const pool = await ensureDatabase();
  await pool.query(
    `INSERT INTO strava_oauth_tokens
      (singleton, access_token, refresh_token, expires_at)
     VALUES (TRUE, $1, $2, $3)
     ON CONFLICT (singleton) DO UPDATE SET
       access_token = EXCLUDED.access_token,
       refresh_token = EXCLUDED.refresh_token,
       expires_at = EXCLUDED.expires_at,
       updated_at = NOW()`,
    [token.access_token, token.refresh_token, token.expires_at]
  );
}

export async function getWeeklyActivities(
  athleteId: string,
  weekStart: string
): Promise<StoredStravaActivity[]> {
  const pool = await ensureDatabase();
  const result = await pool.query(
    `SELECT activity_id AS id, athlete_id AS "athleteId",
            activity_name AS name, distance_km AS "distanceKm",
            moving_time_seconds AS "movingTimeSeconds",
            start_date AS "startDate", start_date_local AS "startDateLocal",
            average_heartrate AS "averageHeartrate", laps,
            is_interval_day AS "isIntervalDay"
     FROM weekly_activities
     WHERE athlete_id = $1 AND week_start = $2::date
     ORDER BY start_date_local`,
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
  }));
}

export async function getRecentAthleteActivities(
  athleteId: string
): Promise<StoredStravaActivity[]> {
  const pool = await ensureDatabase();
  const result = await pool.query(
    `SELECT activity_id AS id, athlete_id AS "athleteId",
            activity_name AS name, distance_km AS "distanceKm",
            moving_time_seconds AS "movingTimeSeconds",
            start_date AS "startDate", start_date_local AS "startDateLocal",
            average_heartrate AS "averageHeartrate", laps,
            is_interval_day AS "isIntervalDay"
     FROM weekly_activities
     WHERE athlete_id = $1
     ORDER BY start_date_local DESC
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
