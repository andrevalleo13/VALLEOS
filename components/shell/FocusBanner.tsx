"use client";
import { useAppStore } from "@/lib/store";
import { X } from "lucide-react";

export function FocusBanner() {
  const { focusMode, setFocusMode } = useAppStore();
  if (!focusMode) return null;

  return (
    <>
      <div className="focus-banner" />
      <div className="focus-pill">
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "var(--gold)",
            display: "inline-block",
          }}
        />
        Modo Focus activo
        <button
          onClick={() => setFocusMode(false)}
          style={{ marginLeft: 8, opacity: 0.6, cursor: "pointer", display: "flex" }}
        >
          <X size={12} />
        </button>
      </div>
    </>
  );
}
