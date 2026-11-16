import { NextResponse } from "next/server";
import { getAthletes, saveAthletes } from "@/utils/database";
import {
  getRequestAthleteSession,
  isAdminRequest,
} from "@/utils/admin-auth";

export const dynamic = "force-dynamic";

function privateJson(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Vary", "Cookie");
  return response;
}

export async function GET(request: Request) {
  try {
    const [isAdmin, athleteSession, athletes] = await Promise.all([
      isAdminRequest(request),
      getRequestAthleteSession(request),
      getAthletes(),
    ]);

    if (isAdmin || athleteSession) return privateJson(athletes);

    return privateJson(
      athletes
        .filter((athlete) => athlete.inClub)
        .map((athlete) => ({
          id: athlete.id,
          nickname: athlete.nickname,
          stravaName: "",
          gender: athlete.gender,
          distanceKm: 0,
          runsCount: 0,
          inClub: true,
        }))
    );
  } catch (err) {
    console.error("Error reading athletes from PostgreSQL:", err);
    return privateJson(
      { error: "ไม่สามารถโหลดรายชื่อนักกีฬาจาก PostgreSQL ได้" },
      { status: 503 }
    );
  }
}

export async function POST(req: Request) {
  if (!(await isAdminRequest(req))) {
    return privateJson({ error: "Admin login required." }, { status: 401 });
  }

  try {
    const updated: unknown = await req.json();
    if (
      !Array.isArray(updated) ||
      updated.some(
        (athlete) =>
          !athlete ||
          typeof athlete.id !== "string" ||
          typeof athlete.nickname !== "string" ||
          typeof athlete.stravaName !== "string" ||
          !["M", "F"].includes(athlete.gender) ||
          typeof athlete.inClub !== "boolean"
      )
    ) {
      return privateJson({ error: "รายชื่อนักกีฬาไม่ถูกต้อง" }, { status: 400 });
    }

    await saveAthletes(updated);
    return privateJson({ success: true, athletes: updated });
  } catch (err: any) {
    console.error("Error saving athletes to PostgreSQL:", err);
    return privateJson(
      { success: false, error: "ไม่สามารถบันทึกรายชื่อนักกีฬาใน PostgreSQL ได้" },
      { status: 503 }
    );
  }
}
