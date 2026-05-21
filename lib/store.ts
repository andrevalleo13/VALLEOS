"use client";
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
}

interface AppState {
  locked: boolean;
  cmdkOpen: boolean;
  captureOpen: boolean;
  focusMode: boolean;
  cierreOpen: boolean;
  ajustesOpen: boolean;
  mobileMenu: boolean;
  ajustes: Ajustes;

  setLocked: (v: boolean) => void;
  setCmdkOpen: (v: boolean) => void;
  setCaptureOpen: (v: boolean) => void;
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
      ajustes: {
        theme: "oro-negro",
        font: "geist",
        radius: "default",
        accentColor: null,
        sidebarCollapsed: false,
      },

      setLocked: (v) => set({ locked: v }),
      setCmdkOpen: (v) => set({ cmdkOpen: v }),
      setCaptureOpen: (v) => set({ captureOpen: v }),
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
