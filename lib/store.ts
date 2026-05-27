"use client";
import { useEffect } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Theme =
  | "oro-negro"
  | "marea-fria"
  | "bosque"
  | "sangre"
  | "papel"
  | "cosmos";

export type Font = "geist" | "instrument" | "mono";

interface Ajustes {
  theme: Theme;
  font: Font;
  radius: "compact" | "default" | "round";
  accentColor: string | null;
  sidebarCollapsed: boolean;
  customColors: Record<string, string>;
  sounds: boolean;
  academia: { targetGpa: number; creditsTarget: number };
}

interface AppState {
  locked: boolean;
  cmdkOpen: boolean;
  captureOpen: boolean;
  focusMode: boolean;
  cierreOpen: boolean;
  ajustesOpen: boolean;
  mobileMenu: boolean;
  quickAction: string | null;
  ajustes: Ajustes;

  setLocked: (v: boolean) => void;
  setCmdkOpen: (v: boolean) => void;
  setCaptureOpen: (v: boolean) => void;
  setQuickAction: (v: string | null) => void;
  setFocusMode: (v: boolean) => void;
  setCierreOpen: (v: boolean) => void;
  setAjustesOpen: (v: boolean) => void;
  setMobileMenu: (v: boolean) => void;
  setAjustes: (patch: Partial<Ajustes>) => void;
  setTheme: (theme: Theme) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      locked: false,
      cmdkOpen: false,
      captureOpen: false,
      focusMode: false,
      cierreOpen: false,
      ajustesOpen: false,
      mobileMenu: false,
      quickAction: null,
      ajustes: {
        theme: "oro-negro",
        font: "geist",
        radius: "default",
        accentColor: null,
        sidebarCollapsed: false,
        customColors: {},
        sounds: true,
        academia: { targetGpa: 9.0, creditsTarget: 400 },
      },

      setLocked: (v) => set({ locked: v }),
      setCmdkOpen: (v) => set({ cmdkOpen: v }),
      setCaptureOpen: (v) => set({ captureOpen: v }),
      setQuickAction: (v) => set({ quickAction: v }),
      setFocusMode: (v) => set({ focusMode: v }),
      setCierreOpen: (v) => set({ cierreOpen: v }),
      setAjustesOpen: (v) => set({ ajustesOpen: v }),
      setMobileMenu: (v) => set({ mobileMenu: v }),
      setAjustes: (patch) =>
        set((s) => ({ ajustes: { ...s.ajustes, ...patch } })),
      setTheme: (theme) =>
        set((s) => ({ ajustes: { ...s.ajustes, theme } })),
    }),
    {
      name: "valleos-store",
      partialize: (s) => ({ ajustes: s.ajustes }),
    }
  )
);

// Las islas (AddEntry, LogWeight, AddGoal, LogSession) registran su key aquí.
// CmdK setea quickAction + navega a la página → la isla se auto-abre y limpia el flag.
export function useQuickAction(key: string, open: () => void) {
  const quickAction = useAppStore((s) => s.quickAction);
  const setQuickAction = useAppStore((s) => s.setQuickAction);
  useEffect(() => {
    if (quickAction === key) {
      open();
      setQuickAction(null);
    }
  }, [quickAction, key, open, setQuickAction]);
}
