"use client";
import { useState, useRef } from "react";
import { Logo } from "@/components/Logo";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);
  function getSupabase() {
    if (!supabaseRef.current) supabaseRef.current = createClient();
    return supabaseRef.current;
  }

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error } = await getSupabase().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/` },
    });

    if (error) {
      setError(error.message);
    } else {
      setSent(true);
    }
    setLoading(false);
  }

  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg-deep)",
        padding: "24px",
        position: "relative",
      }}
    >
      {/* Ambient */}
      <div className="ambient">
        <div className="ambient-blob ambient-blob-1" />
        <div className="ambient-blob ambient-blob-2" />
      </div>

      <div
        className="glass"
        style={{
          width: "100%",
          maxWidth: 400,
          borderRadius: "var(--radius-lg)",
          padding: "48px 40px",
          position: "relative",
          zIndex: 1,
          boxShadow: "0 40px 100px rgba(0,0,0,0.4)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <Logo variant="mark" className="mx-auto mb-4 w-12 h-12" />
          <h1
            className="serif"
            style={{ fontSize: 32, color: "var(--bone)", marginBottom: 8 }}
          >
            Valle OS
          </h1>
          <p style={{ color: "var(--mute)", fontSize: 14 }}>
            Tu sistema operativo personal
          </p>
        </div>

        {sent ? (
          <div style={{ textAlign: "center" }}>
            <div className="orb-sm mx-auto mb-4" />
            <p style={{ color: "var(--bone-dim)", fontSize: 15, lineHeight: 1.6 }}>
              Revisa tu correo — te mandamos un enlace mágico a{" "}
              <strong style={{ color: "var(--gold)" }}>{email}</strong>
            </p>
          </div>
        ) : (
          <form onSubmit={signIn}>
            <label className="input-label">Correo electrónico</label>
            <input
              className="input mb-4"
              type="email"
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
            {error && (
              <p style={{ color: "var(--red)", fontSize: 13, marginBottom: 12 }}>{error}</p>
            )}
            <button
              className="btn btn-primary w-full"
              style={{ width: "100%", justifyContent: "center" }}
              type="submit"
              disabled={loading}
            >
              {loading ? "Enviando..." : "Entrar con magic link"}
            </button>
          </form>
        )}
      </div>

      <p className="tick mt-8" style={{ position: "relative", zIndex: 1 }}>
        Valle OS · Sistema privado
      </p>
    </div>
  );
}
