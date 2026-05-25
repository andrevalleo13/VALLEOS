"use client";
import { useRef } from "react";

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  presets?: string[];
  size?: number;
}

export const COLOR_PRESETS = [
  "#C9A35F", "#7FA98C", "#5B8DB8", "#8B77CC", "#D96B58",
  "#E8A87C", "#6BB8C4", "#F5C842", "#E87BC4", "#9A9A9A",
];

export function ColorPicker({
  value,
  onChange,
  presets = COLOR_PRESETS,
  size = 28,
}: ColorPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const normalizedValue = value?.toLowerCase() ?? "";
  const isCustom = !presets.some((p) => p.toLowerCase() === normalizedValue);

  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      {presets.map((c) => {
        const active = c.toLowerCase() === normalizedValue;
        return (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            aria-label={c}
            style={{
              width: size,
              height: size,
              borderRadius: "50%",
              background: c,
              cursor: "pointer",
              border: active ? "2px solid var(--bone)" : "2px solid transparent",
              outline: active ? "1px solid rgba(245,242,234,0.3)" : "none",
              outlineOffset: 2,
              flexShrink: 0,
              transition: "transform 0.12s, outline 0.12s",
            }}
          />
        );
      })}

      {/* Custom color button */}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        title="Color personalizado"
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          background: isCustom ? value : "var(--bg-raised)",
          border: isCustom ? "2px solid var(--bone)" : "1px dashed var(--mute)",
          outline: isCustom ? "1px solid rgba(245,242,234,0.3)" : "none",
          outlineOffset: 2,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          position: "relative",
          overflow: "hidden",
          color: "var(--mute)",
          fontSize: 14,
          fontWeight: 400,
          lineHeight: 1,
        }}
      >
        {!isCustom && "+"}
        <input
          ref={inputRef}
          type="color"
          value={isCustom ? value : "#C9A35F"}
          onChange={(e) => onChange(e.target.value)}
          style={{
            position: "absolute",
            inset: 0,
            opacity: 0,
            width: "100%",
            height: "100%",
            cursor: "pointer",
            border: "none",
            padding: 0,
          }}
        />
      </button>
    </div>
  );
}
