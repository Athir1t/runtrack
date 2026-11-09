import { NextResponse } from "next/server";
import { getAthletes, saveAthletes } from "@/utils/database";
import { isAdminRequest } from "@/utils/admin-auth";

export async function GET() {
  try {
    return NextResponse.json(await getAthletes());
  } catch (err) {
    console.error("Error reading athletes from PostgreSQL:", err);
    return NextResponse.json(
      { error: "ไม่สามารถโหลดรายชื่อนักกีฬาจาก PostgreSQL ได้" },
      { status: 503 }
    );
  }
}

export async function POST(req: Request) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: "Admin login required." }, { status: 401 });
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
      return NextResponse.json({ error: "รายชื่อนักกีฬาไม่ถูกต้อง" }, { status: 400 });
    }

    await saveAthletes(updated);
    return NextResponse.json({ success: true, athletes: updated });
  } catch (err: any) {
    console.error("Error saving athletes to PostgreSQL:", err);
    return NextResponse.json(
      { success: false, error: "ไม่สามารถบันทึกรายชื่อนักกีฬาใน PostgreSQL ได้" },
      { status: 503 }
    );
  }
}
