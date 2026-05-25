const DAEMON_URL = "http://localhost:3999/action";
const DAEMON_PING = "http://localhost:3999/ping";
const DAEMON_KEY =
  typeof process !== "undefined"
    ? (process.env.NEXT_PUBLIC_SHADOW_DAEMON_KEY ?? "valleos-shadow-daemon")
    : "valleos-shadow-daemon";

function headers() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${DAEMON_KEY}`,
  };
}

export type DaemonResult = { ok: boolean; result?: string; error?: string };

export async function callDaemon(data: Record<string, unknown>): Promise<DaemonResult> {
  try {
    const res = await fetch(DAEMON_URL, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(data),
    });
    if (!res.ok) return { ok: false, error: `Daemon HTTP ${res.status}` };
    return (await res.json()) as DaemonResult;
  } catch {
    return { ok: false, error: "Daemon no activo — inicia shadow-daemon.js en tu Mac" };
  }
}

export async function pingDaemon(): Promise<boolean> {
  try {
    const res = await fetch(DAEMON_PING, { headers: headers(), signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}
