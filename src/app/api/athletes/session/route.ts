import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  getAthleteSessionCookieName,
  verifyAthleteSession,
} from "@/utils/admin-auth";
import { getAthletes } from "@/utils/database";

export async function GET() {
  const cookieStore = await cookies();
  const session = await verifyAthleteSession(
    cookieStore.get(getAthleteSessionCookieName())?.value
  );
  if (!session) {
    return NextResponse.json({ authenticated: false });
  }

  const athlete = (await getAthletes()).find(
    (item) => item.id === session.athleteId
  );
  if (!athlete) {
    return NextResponse.json({ authenticated: false });
  }
  return NextResponse.json({
    authenticated: true,
    athleteId: athlete.id,
    athleteName: athlete.nickname,
  });
}
