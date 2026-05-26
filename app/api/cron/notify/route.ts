import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { pushToAll } from "@/lib/push/send";
import type { Database } from "@/lib/supabase/types";

function sb() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Empuja a los dispositivos las notificaciones nuevas (las que Shadow crea con
// crear_notificacion) aunque la PWA esté cerrada. Idempotente vía flag `pushed`.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }

  const supabase = sb();
  const { data: pending } = await supabase
    .from("notifications")
    .select("*")
    .eq("pushed", false)
    .eq("dismissed", false)
    .order("created_at", { ascending: true })
    .limit(20);

  if (!pending || pending.length === 0) return NextResponse.json({ ok: true, pushed: 0 });

  let pushed = 0;
  for (const n of pending) {
    const sent = await pushToAll({
      title: n.title,
      body: n.body ?? undefined,
      href: n.href ?? "/",
      tag: n.id,
    });
    if (sent >= 0) pushed++;
  }

  await supabase
    .from("notifications")
    .update({ pushed: true })
    .in("id", pending.map((n) => n.id));

  return NextResponse.json({ ok: true, pushed });
}
