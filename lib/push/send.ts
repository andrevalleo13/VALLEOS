import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

let configured = false;
function configure(): boolean {
  if (configured) return true;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:andrevalleo13@gmail.com",
    pub,
    priv
  );
  configured = true;
  return true;
}

function sb() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export type PushPayload = { title: string; body?: string; href?: string; tag?: string };

// Empuja a todas las suscripciones guardadas. Devuelve cuántas recibieron.
export async function pushToAll(payload: PushPayload): Promise<number> {
  if (!configure()) return 0;
  const supabase = sb();
  const { data: subs } = await supabase.from("push_subscriptions").select("*");
  if (!subs || subs.length === 0) return 0;

  const body = JSON.stringify(payload);
  let sent = 0;
  const dead: string[] = [];

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body
        );
        sent++;
      } catch (err: unknown) {
        const code = (err as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) dead.push(s.endpoint);
      }
    })
  );

  if (dead.length) await supabase.from("push_subscriptions").delete().in("endpoint", dead);
  return sent;
}
