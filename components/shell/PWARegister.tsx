"use client";
import { useEffect } from "react";
import { initPWA } from "@/lib/pwa/install";

export function PWARegister() {
  useEffect(() => {
    initPWA();
  }, []);
  return null;
}
