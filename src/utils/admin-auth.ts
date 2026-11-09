const SESSION_COOKIE = "runtrack_admin";
const ATHLETE_SESSION_COOKIE = "runtrack_athlete";
const SESSION_DURATION_SECONDS = 12 * 60 * 60;

export interface AthleteSession {
  athleteId: string;
  athleteName?: string;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function decodeBase64Url(value: string): Uint8Array {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function getSigningKey(): Promise<CryptoKey> {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("ADMIN_SESSION_SECRET must contain at least 32 characters");
  }
  return crypto.subtle.importKey(
    "raw",
    toArrayBuffer(new TextEncoder().encode(secret)),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export function isAdminConfigured(): boolean {
  return Boolean(
    process.env.ADMIN_USERNAME &&
      process.env.ADMIN_PASSWORD &&
      process.env.ADMIN_PASSWORD.length >= 11 &&
      process.env.ADMIN_SESSION_SECRET &&
      process.env.ADMIN_SESSION_SECRET.length >= 32
  );
}

export function getAdminSessionCookieName(): string {
  return SESSION_COOKIE;
}

export function getAthleteSessionCookieName(): string {
  return ATHLETE_SESSION_COOKIE;
}

export async function isAdminRequest(request: Request): Promise<boolean> {
  const cookie = request.headers
    .get("cookie")
    ?.split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${SESSION_COOKIE}=`))
    ?.slice(SESSION_COOKIE.length + 1);
  return verifyAdminSession(cookie);
}

export function getAdminSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  };
}

export async function createAdminSession(): Promise<string> {
  return createSignedSession({ role: "admin" });
}

export async function createAthleteSession(
  athleteId: string,
  athleteName: string
): Promise<string> {
  return createSignedSession({ role: "athlete", athleteId, athleteName });
}

async function createSignedSession(
  identity: { role: "admin" } | { role: "athlete"; athleteId: string; athleteName: string }
): Promise<string> {
  const payload = encodeBase64Url(
    new TextEncoder().encode(
      JSON.stringify({
        ...identity,
        expiresAt: Math.floor(Date.now() / 1000) + SESSION_DURATION_SECONDS,
      })
    )
  );
  const key = await getSigningKey();
  const signature = new Uint8Array(
    await crypto.subtle.sign(
      "HMAC",
      key,
      toArrayBuffer(new TextEncoder().encode(payload))
    )
  );
  return `${payload}.${encodeBase64Url(signature)}`;
}

async function verifySession(token: string | undefined): Promise<{
  role: "admin" | "athlete";
  athleteId?: string;
  athleteName?: string;
} | null> {
  if (!token || !isAdminConfigured()) return null;
  const [payload, encodedSignature, ...extra] = token.split(".");
  if (!payload || !encodedSignature || extra.length > 0) return null;

  try {
    const signatureIsValid = await crypto.subtle.verify(
      "HMAC",
      await getSigningKey(),
      toArrayBuffer(decodeBase64Url(encodedSignature)),
      toArrayBuffer(new TextEncoder().encode(payload))
    );
    if (!signatureIsValid) return null;

    const data: unknown = JSON.parse(
      new TextDecoder().decode(decodeBase64Url(payload))
    );
    if (
      typeof data !== "object" ||
      data === null ||
      !("expiresAt" in data) ||
      typeof data.expiresAt !== "number" ||
      data.expiresAt <= Math.floor(Date.now() / 1000)
    ) {
      return null;
    }

    if (!("role" in data) || (data.role !== "admin" && data.role !== "athlete")) {
      return null;
    }
    if (data.role === "athlete") {
      if (!("athleteId" in data) || typeof data.athleteId !== "string") {
        return null;
      }
      return {
        role: "athlete",
        athleteId: data.athleteId,
        athleteName:
          "athleteName" in data && typeof data.athleteName === "string"
            ? data.athleteName
            : undefined,
      };
    }
    return { role: "admin" };
  } catch {
    return null;
  }
}

export async function verifyAdminSession(token: string | undefined): Promise<boolean> {
  return (await verifySession(token))?.role === "admin";
}

export async function verifyAthleteSession(
  token: string | undefined
): Promise<AthleteSession | null> {
  const session = await verifySession(token);
  if (session?.role !== "athlete" || !session.athleteId) return null;
  return {
    athleteId: session.athleteId,
    athleteName: session.athleteName,
  };
}

export async function getRequestAthleteSession(
  request: Request
): Promise<AthleteSession | null> {
  const cookie = request.headers
    .get("cookie")
    ?.split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${ATHLETE_SESSION_COOKIE}=`))
    ?.slice(ATHLETE_SESSION_COOKIE.length + 1);
  return verifyAthleteSession(cookie);
}
