import type { Theme } from "./store";

export const THEMES: { id: Theme; label: string; bg: string; accent: string }[] = [
  { id: "oro-negro",  label: "Oro Negro",  bg: "#0B0B0E", accent: "#C9A35F" },
  { id: "marea-fria", label: "Marea Fría", bg: "#090D14", accent: "#5B8DB8" },
  { id: "bosque",     label: "Bosque",     bg: "#090E0B", accent: "#7FA98C" },
  { id: "sangre",     label: "Sangre",     bg: "#130A09", accent: "#D96B58" },
  { id: "papel",      label: "Papel",      bg: "#F5F2EA", accent: "#A6864A" },
  { id: "cosmos",     label: "Cosmos",     bg: "#0A0814", accent: "#8B77CC" },
];

const CUSTOM_VARS = [
  "--gold", "--gold-2", "--gold-glow",
  "--bg", "--bg-deep",
  "--bone", "--bone-dim",
];

export function applyTheme(theme: Theme, customColors?: Record<string, string>) {
  document.body.setAttribute("data-theme", theme);
  CUSTOM_VARS.forEach((v) => document.documentElement.style.removeProperty(v));
  if (customColors) {
    Object.entries(customColors).forEach(([k, v]) => {
      document.documentElement.style.setProperty(k, v);
    });
  }
}
