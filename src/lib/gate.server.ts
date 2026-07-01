import { useSession } from "@tanstack/react-start/server";
import { createHash, timingSafeEqual } from "node:crypto";

type GateSession = { unlocked?: boolean };

export function getSessionConfig() {
  return {
    password: process.env.SESSION_SECRET || "a-very-long-and-secure-fallback-secret-for-lead-app-store",
    name: "lead-app-store-admin",
    maxAge: 60 * 60 * 8,
    cookie: {
      httpOnly: true,
      secure: true,
      sameSite: "lax" as const,
      path: "/",
    },
  };
}

export function matches(input: string, expected: string): boolean {
  const a = createHash("sha256").update(input, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}

export async function assertAdmin() {
  const session = await useSession<GateSession>(getSessionConfig());
  if (!session.data.unlocked) {
    throw new Error("Unauthorized");
  }
}
