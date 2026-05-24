"use client";
import { useState } from "react";
import type { MuscleKey } from "@/lib/gym/muscles";
import { muscleLabel } from "@/lib/gym/muscles";

export type MuscleStat = { sets: number; intensity: number };

type Region = { muscle: MuscleKey; d: string };

// Silueta base compartida (relleno suave detrás de los músculos).
const BODY =
  "M100 18 C115 18 124 29 124 42 C124 52 119 59 111 62 C128 64 140 74 150 92 " +
  "C160 110 162 150 160 182 C159 205 156 215 150 224 C145 231 139 228 138 218 " +
  "C136 205 136 150 130 120 L130 150 C131 175 134 200 132 225 C130 250 128 270 126 300 " +
  "C124 340 120 390 114 445 C112 460 104 462 100 452 C96 462 88 460 86 445 " +
  "C80 390 76 340 74 300 C72 270 70 250 68 225 C66 200 69 175 70 150 L70 120 " +
  "C64 150 64 205 62 218 C61 228 55 231 50 224 C44 215 41 205 40 182 " +
  "C38 150 40 110 50 92 C60 74 72 64 89 62 C81 59 76 52 76 42 C76 29 85 18 100 18 Z";

const FRONT: Region[] = [
  { muscle: "hombros", d: "M72 78 Q56 80 50 96 Q47 108 56 112 Q68 110 74 98 Q76 86 72 78 Z" },
  { muscle: "hombros", d: "M128 78 Q144 80 150 96 Q153 108 144 112 Q132 110 126 98 Q124 86 128 78 Z" },
  { muscle: "pecho", d: "M98 86 Q84 84 74 92 Q66 100 72 114 Q84 124 97 116 Q100 104 98 86 Z" },
  { muscle: "pecho", d: "M102 86 Q116 84 126 92 Q134 100 128 114 Q116 124 103 116 Q100 104 102 86 Z" },
  { muscle: "biceps", d: "M54 112 Q47 128 49 150 Q52 162 60 158 Q64 140 62 118 Q60 110 54 112 Z" },
  { muscle: "biceps", d: "M146 112 Q153 128 151 150 Q148 162 140 158 Q136 140 138 118 Q140 110 146 112 Z" },
  { muscle: "antebrazo", d: "M50 156 Q45 176 50 200 Q54 212 61 206 Q63 184 60 160 Q57 152 50 156 Z" },
  { muscle: "antebrazo", d: "M150 156 Q155 176 150 200 Q146 212 139 206 Q137 184 140 160 Q143 152 150 156 Z" },
  { muscle: "abdomen", d: "M86 120 L114 120 Q118 160 110 206 L90 206 Q82 160 86 120 Z" },
  { muscle: "cuadriceps", d: "M76 256 Q66 290 72 338 Q78 354 90 348 Q94 304 92 260 Q88 250 76 256 Z" },
  { muscle: "cuadriceps", d: "M124 256 Q134 290 128 338 Q122 354 110 348 Q106 304 108 260 Q112 250 124 256 Z" },
  { muscle: "pantorrillas", d: "M78 372 Q72 400 78 436 Q82 448 90 442 Q93 408 90 374 Q86 366 78 372 Z" },
  { muscle: "pantorrillas", d: "M122 372 Q128 400 122 436 Q118 448 110 442 Q107 408 110 374 Q114 366 122 372 Z" },
];

const BACK: Region[] = [
  { muscle: "hombros", d: "M72 78 Q56 80 50 96 Q47 108 56 112 Q68 110 74 98 Q76 86 72 78 Z" },
  { muscle: "hombros", d: "M128 78 Q144 80 150 96 Q153 108 144 112 Q132 110 126 98 Q124 86 128 78 Z" },
  { muscle: "trapecio", d: "M100 64 Q120 72 122 92 Q112 104 100 108 Q88 104 78 92 Q80 72 100 64 Z" },
  { muscle: "espalda", d: "M76 100 Q66 120 72 160 Q80 180 96 176 Q98 140 96 108 Q88 98 76 100 Z" },
  { muscle: "espalda", d: "M124 100 Q134 120 128 160 Q120 180 104 176 Q102 140 104 108 Q112 98 124 100 Z" },
  { muscle: "triceps", d: "M54 112 Q47 130 50 152 Q53 162 60 158 Q63 140 61 118 Q59 110 54 112 Z" },
  { muscle: "triceps", d: "M146 112 Q153 130 150 152 Q147 162 140 158 Q137 140 139 118 Q141 110 146 112 Z" },
  { muscle: "antebrazo", d: "M50 156 Q45 176 50 200 Q54 212 61 206 Q63 184 60 160 Q57 152 50 156 Z" },
  { muscle: "antebrazo", d: "M150 156 Q155 176 150 200 Q146 212 139 206 Q137 184 140 160 Q143 152 150 156 Z" },
  { muscle: "lumbar", d: "M88 178 L112 178 Q116 200 110 224 L90 224 Q84 200 88 178 Z" },
  { muscle: "gluteos", d: "M78 232 Q66 242 70 266 Q76 282 92 276 Q96 254 94 236 Q88 228 78 232 Z" },
  { muscle: "gluteos", d: "M122 232 Q134 242 130 266 Q124 282 108 276 Q104 254 106 236 Q112 228 122 232 Z" },
  { muscle: "isquios", d: "M76 284 Q68 312 74 344 Q80 358 91 352 Q94 318 92 288 Q86 280 76 284 Z" },
  { muscle: "isquios", d: "M124 284 Q132 312 126 344 Q120 358 109 352 Q106 318 108 288 Q114 280 124 284 Z" },
  { muscle: "pantorrillas", d: "M78 366 Q70 396 78 434 Q83 448 91 442 Q94 404 90 368 Q86 360 78 366 Z" },
  { muscle: "pantorrillas", d: "M122 366 Q130 396 122 434 Q117 448 109 442 Q106 404 110 368 Q114 360 122 366 Z" },
];

function heat(t: number): string {
  if (!t || t <= 0) return "rgba(130,130,142,0.07)";
  const c = Math.min(Math.max(t, 0), 1);
  const r = Math.round(201 + (217 - 201) * c);
  const g = Math.round(163 + (107 - 163) * c);
  const b = Math.round(95 + (74 - 95) * c);
  const a = 0.24 + c * 0.62;
  return `rgba(${r},${g},${b},${a})`;
}

function Figure({
  label,
  regions,
  data,
  onHover,
}: {
  label: string;
  regions: Region[];
  data: Partial<Record<MuscleKey, MuscleStat>>;
  onHover: (m: MuscleKey | null) => void;
}) {
  return (
    <div className="mm-figure">
      <svg viewBox="0 0 200 480" className="mm-svg" role="img" aria-label={`Vista ${label}`}>
        <path d={BODY} className="mm-body" />
        <ellipse cx="100" cy="40" rx="19" ry="22" className="mm-base" />
        <path d="M90 58 L110 58 L108 73 Q100 79 92 73 Z" className="mm-base" />
        <ellipse cx="44" cy="232" rx="7" ry="11" className="mm-base" />
        <ellipse cx="156" cy="232" rx="7" ry="11" className="mm-base" />
        <ellipse cx="86" cy="458" rx="9" ry="8" className="mm-base" />
        <ellipse cx="114" cy="458" rx="9" ry="8" className="mm-base" />
        {regions.map((rg, i) => {
          const st = data[rg.muscle];
          return (
            <path
              key={i}
              d={rg.d}
              className="mm-muscle"
              fill={heat(st?.intensity ?? 0)}
              onMouseEnter={() => onHover(rg.muscle)}
              onMouseLeave={() => onHover(null)}
            >
              <title>{`${muscleLabel(rg.muscle)} · ${st?.sets ?? 0} series`}</title>
            </path>
          );
        })}
        <path d={BODY} className="mm-outline" />
      </svg>
      <span className="mm-caption">{label}</span>
    </div>
  );
}

export function MuscleMap({ data }: { data: Partial<Record<MuscleKey, MuscleStat>> }) {
  const [hover, setHover] = useState<MuscleKey | null>(null);
  const hv = hover ? data[hover] : null;

  return (
    <div className="mm-wrap">
      <div className="mm-figures">
        <Figure label="Frente" regions={FRONT} data={data} onHover={setHover} />
        <Figure label="Espalda" regions={BACK} data={data} onHover={setHover} />
      </div>
      <div className="mm-readout">
        {hover ? (
          <>
            <span className="mm-readout-name">{muscleLabel(hover)}</span>
            <span className="mm-readout-val">{hv?.sets ?? 0} series</span>
          </>
        ) : (
          <span className="mm-readout-hint">Pasa el cursor sobre un músculo</span>
        )}
      </div>
    </div>
  );
}
