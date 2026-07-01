import { createServerFn } from "@tanstack/react-start";

export const getAdminStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { useSession } = await import("@tanstack/react-start/server");
  const { getSessionConfig } = await import("./gate.server");
  const session = await useSession(getSessionConfig());
  return { isAdmin: !!session.data.unlocked };
});

export const unlockAdmin = createServerFn({ method: "POST" })
  .inputValidator((data: { passcode: string }) => data)
  .handler(async ({ data }) => {
    const { useSession } = await import("@tanstack/react-start/server");
    const { getSessionConfig, matches } = await import("./gate.server");

    const expected = process.env.ADMIN_PASSCODE || "Lead@123";

    if (!data.passcode) {
      return { ok: false as const };
    }

    if (!matches(data.passcode, expected)) {
      return { ok: false as const };
    }
    const session = await useSession(getSessionConfig());
    await session.update({ unlocked: true });
    return { ok: true as const };
  });

export const lockAdmin = createServerFn({ method: "POST" }).handler(async () => {
  const { useSession } = await import("@tanstack/react-start/server");
  const { getSessionConfig } = await import("./gate.server");
  const session = await useSession(getSessionConfig());
  await session.clear();
  return { ok: true as const };
});
