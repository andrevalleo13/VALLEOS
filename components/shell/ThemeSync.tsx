"use client";
import { useEffect } from "react";
import { useAppStore } from "@/lib/store";
import { applyTheme } from "@/lib/themes";

export function ThemeSync() {
  const { ajustes } = useAppStore();
  useEffect(() => {
    applyTheme(ajustes.theme);
  }, [ajustes.theme]);
  return null;
}
