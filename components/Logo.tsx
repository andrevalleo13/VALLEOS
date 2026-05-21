"use client";
import { cn } from "@/lib/utils";

interface LogoProps {
  variant?: "full" | "mark" | "wordmark";
  className?: string;
}

export function Logo({ variant = "full", className }: LogoProps) {
  if (variant === "mark") {
    return (
      <svg
        className={cn("h-7 w-7", className)}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="20" cy="20" r="18" stroke="var(--gold)" strokeWidth="1.5" />
        <circle cx="20" cy="20" r="10" fill="var(--gold)" opacity="0.15" />
        <circle cx="20" cy="20" r="4" fill="var(--gold)" />
        <line x1="20" y1="2" x2="20" y2="10" stroke="var(--gold)" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="20" y1="30" x2="20" y2="38" stroke="var(--gold)" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="2" y1="20" x2="10" y2="20" stroke="var(--gold)" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="30" y1="20" x2="38" y2="20" stroke="var(--gold)" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }

  if (variant === "wordmark") {
    return (
      <span
        className={cn("font-serif text-xl tracking-wide", className)}
        style={{ color: "var(--bone)", fontFamily: "var(--f-serif)" }}
      >
        Valle<span style={{ color: "var(--gold)" }}>OS</span>
      </span>
    );
  }

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <Logo variant="mark" />
      <Logo variant="wordmark" />
    </div>
  );
}
