"use client";
import { useState, useEffect, useCallback } from "react";
import { Fingerprint, Scan, Delete } from "lucide-react";

const SESSION_KEY = "valleos-unlocked";
const PIN_HASH_KEY = "valleos-pin-hash";
const CRED_KEY = "valleos-biometric-id";

async function hashPin(pin: string): Promise<string> {
  const data = new TextEncoder().encode("valleos:" + pin);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function registerBiometrics(): Promise<string | null> {
  try {
    const cred = await navigator.credentials.create({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rp: { name: "Valle OS", id: location.hostname },
        user: {
          id: crypto.getRandomValues(new Uint8Array(16)),
          name: "andre",
          displayName: "André",
        },
        pubKeyCredParams: [
          { alg: -7, type: "public-key" },
          { alg: -257, type: "public-key" },
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "required",
          residentKey: "preferred",
        },
        timeout: 60000,
      },
    }) as PublicKeyCredential | null;

    if (!cred) return null;
    const id = btoa(String.fromCharCode(...new Uint8Array(cred.rawId)));
    localStorage.setItem(CRED_KEY, id);
    return id;
  } catch {
    return null;
  }
}

async function authenticateBiometrics(credIdBase64: string): Promise<boolean> {
  try {
    const credIdBytes = Uint8Array.from(atob(credIdBase64), (c) => c.charCodeAt(0));
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rpId: location.hostname,
        userVerification: "required",
        allowCredentials: [{ id: credIdBytes, type: "public-key" }],
        timeout: 60000,
      },
    });
    return !!assertion;
  } catch {
    return false;
  }
}

const DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"];

export function LockScreen({ children }: { children: React.ReactNode }) {
  const [unlocked, setUnlocked] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState<"unlock" | "setup" | "confirm">("unlock");
  const [pin, setPin] = useState("");
  const [setupPin, setSetupPin] = useState("");
  const [error, setError] = useState("");
  const [bioAvail, setBioAvail] = useState(false);
  const [credId, setCredId] = useState<string | null>(null);
  const [bioLoading, setBioLoading] = useState(false);
  const [offerBio, setOfferBio] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (sessionStorage.getItem(SESSION_KEY) === "1") {
      setUnlocked(true);
      return;
    }
    const hasPin = !!localStorage.getItem(PIN_HASH_KEY);
    const storedCred = localStorage.getItem(CRED_KEY);
    setCredId(storedCred);
    setStep(hasPin ? "unlock" : "setup");

    if (typeof window !== "undefined" && window.PublicKeyCredential) {
      PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().then(
        setBioAvail
      );
    }
  }, []);

  // Auto-trigger biometrics on load if credential exists
  useEffect(() => {
    if (mounted && !unlocked && step === "unlock" && credId && bioAvail) {
      handleBiometrics();
    }
  }, [mounted, step, credId, bioAvail]);

  const unlock = useCallback(() => {
    sessionStorage.setItem(SESSION_KEY, "1");
    setUnlocked(true);
  }, []);

  async function handleDigit(d: string) {
    if (d === "⌫") {
      if (step === "unlock") setPin((p) => p.slice(0, -1));
      else setSetupPin((p) => p.slice(0, -1));
      setError("");
      return;
    }
    if (!d) return;

    if (step === "unlock") {
      const next = pin + d;
      setPin(next);
      if (next.length === 4) {
        const stored = localStorage.getItem(PIN_HASH_KEY)!;
        const hash = await hashPin(next);
        if (hash === stored) {
          unlock();
        } else {
          setError("PIN incorrecto");
          setTimeout(() => { setPin(""); setError(""); }, 600);
        }
      }
    } else if (step === "setup") {
      const next = setupPin + d;
      setSetupPin(next);
      if (next.length === 4) {
        setTimeout(() => setStep("confirm"), 200);
        setPin("");
      }
    } else if (step === "confirm") {
      const next = pin + d;
      setPin(next);
      if (next.length === 4) {
        if (next === setupPin) {
          const hash = await hashPin(next);
          localStorage.setItem(PIN_HASH_KEY, hash);
          setOfferBio(true);
        } else {
          setError("Los PINs no coinciden");
          setTimeout(() => { setPin(""); setSetupPin(""); setStep("setup"); setError(""); }, 700);
        }
      }
    }
  }

  async function handleBiometrics() {
    if (!credId) return;
    setBioLoading(true);
    const ok = await authenticateBiometrics(credId);
    setBioLoading(false);
    if (ok) unlock();
    else setError("Biométrico fallido, usa tu PIN");
  }

  async function handleRegisterBio() {
    const id = await registerBiometrics();
    if (id) {
      setCredId(id);
      unlock();
    } else {
      unlock();
    }
  }

  if (!mounted) return null;
  if (unlocked) return <>{children}</>;

  const currentPin = step === "unlock" || step === "confirm" ? pin : setupPin;

  if (offerBio && bioAvail) {
    return (
      <LockWrapper>
        <p className="eyebrow mb-2">PIN creado</p>
        <h2 className="serif mb-1" style={{ fontSize: 28, color: "var(--bone)" }}>
          ¿Activar biométrico?
        </h2>
        <p className="tick mb-8">Face ID / Touch ID / Huella digital</p>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button className="btn btn-primary" style={{ justifyContent: "center", gap: 10 }} onClick={handleRegisterBio}>
            <Fingerprint size={18} /> Activar biométrico
          </button>
          <button className="btn btn-ghost" style={{ justifyContent: "center" }} onClick={unlock}>
            Solo PIN por ahora
          </button>
        </div>
      </LockWrapper>
    );
  }

  return (
    <LockWrapper>
      <div style={{ marginBottom: 8 }}>
        <Scan size={36} style={{ color: "var(--gold)", margin: "0 auto 16px", display: "block" }} />
        <h2 className="serif text-center" style={{ fontSize: 28, color: "var(--bone)" }}>
          {step === "setup" ? "Crea tu PIN" : step === "confirm" ? "Confirma tu PIN" : "Valle OS"}
        </h2>
        <p className="tick text-center mt-1">
          {step === "setup" ? "4 dígitos para proteger tu OS" : step === "confirm" ? "Repite el PIN" : "Ingresa tu PIN"}
        </p>
      </div>

      {/* Dots */}
      <div className="flex gap-4 my-6">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              width: 14, height: 14, borderRadius: "50%",
              background: currentPin.length > i ? "var(--gold)" : "var(--glass-bg-2)",
              border: "1px solid var(--glass-bd-2)",
              transition: "background 0.15s",
            }}
          />
        ))}
      </div>

      {error && (
        <p style={{ color: "var(--red)", fontSize: 13, marginBottom: 8, textAlign: "center" }}>{error}</p>
      )}

      {/* Numpad */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, width: 220 }}>
        {DIGITS.map((d, i) => (
          <button
            key={i}
            onClick={() => d && handleDigit(d)}
            style={{
              height: 60, borderRadius: 14,
              background: d ? "var(--glass-bg)" : "transparent",
              border: d ? "1px solid var(--glass-bd)" : "none",
              color: d === "⌫" ? "var(--mute)" : "var(--bone)",
              fontSize: d === "⌫" ? 20 : 22,
              fontFamily: d === "⌫" ? "inherit" : "var(--f-mono)",
              cursor: d ? "pointer" : "default",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            {d === "⌫" ? <Delete size={18} style={{ color: "var(--mute)" }} /> : d}
          </button>
        ))}
      </div>

      {/* Biometrics button */}
      {step === "unlock" && credId && bioAvail && (
        <button
          className="btn btn-ghost btn-sm"
          style={{ marginTop: 20, gap: 8 }}
          onClick={handleBiometrics}
          disabled={bioLoading}
        >
          <Fingerprint size={16} style={{ color: "var(--gold)" }} />
          {bioLoading ? "Verificando..." : "Usar biométrico"}
        </button>
      )}
    </LockWrapper>
  );
}

function LockWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "var(--bg)",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        className="glass"
        style={{
          padding: "40px 32px", borderRadius: 24,
          display: "flex", flexDirection: "column",
          alignItems: "center", gap: 4, minWidth: 280,
        }}
      >
        {children}
      </div>
    </div>
  );
}
