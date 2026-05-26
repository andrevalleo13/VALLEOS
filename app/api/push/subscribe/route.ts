import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const { endpoint, p256dh, auth, user_agent } = await req.json();
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: "suscripción incompleta" }, { status: 400 });
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("push_subscriptions")
    .upsert({ endpoint, p256dh, auth, user_agent: user_agent ?? null }, { onConflict: "endpoint" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
