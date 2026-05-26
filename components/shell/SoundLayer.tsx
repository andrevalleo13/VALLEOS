"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { setSoundsEnabled, play } from "@/lib/sounds";

export function SoundLayer() {
  const pathname = usePathname();
  const sounds = useAppStore((s) => s.ajustes.sounds ?? true);
  const focusMode = useAppStore((s) => s.focusMode);
  const firstNav = useRef(true);

  useEffect(() => {
    setSoundsEnabled(sounds && !focusMode);
  }, [sounds, focusMode]);

  useEffect(() => {
    if (firstNav.current) {
      firstNav.current = false;
      return;
    }
    play("click");
  }, [pathname]);

  return null;
}
