"use client";
import { Orb } from "@/components/Orb";

type Telem = { l: string; v: string };

export function ShadowHUD({
  thinking = false,
  telemetry,
}: {
  thinking?: boolean;
  telemetry: Telem[];
}) {
  const t = telemetry;
  return (
    <div className="hud-stage" data-state={thinking ? "thinking" : "idle"}>
      <div className="hud-rings">
        <div className="hud-ring" />
        <div className="hud-ring dashed r2" />
        <div className="hud-ring r3" />
        <div className="hud-ring dashed r4" />
        <div className="hud-ring r5" />
      </div>
      <div className="hud-ticks" />
      <div className="hud-cross" />
      <div className="hud-radar" />

      <div className="hud-cardinal n">N</div>
      <div className="hud-cardinal degree" style={{ top: "8%", left: "75%" }}>045°</div>
      <div className="hud-cardinal e">E</div>
      <div className="hud-cardinal degree" style={{ top: "75%", left: "82%" }}>135°</div>
      <div className="hud-cardinal s">S</div>
      <div className="hud-cardinal degree" style={{ top: "82%", left: "18%" }}>225°</div>
      <div className="hud-cardinal w">W</div>
      <div className="hud-cardinal degree" style={{ top: "18%", left: "10%" }}>315°</div>

      {t[0] && <div className="hud-telem t1">{t[0].l} <span className="v">{t[0].v}</span></div>}
      {t[1] && <div className="hud-telem t2">{t[1].l} <span className="v">{t[1].v}</span></div>}
      {t[2] && <div className="hud-telem t3">{t[2].l} <span className="v">{t[2].v}</span></div>}
      {t[3] && <div className="hud-telem t4">{t[3].l} <span className="v">{t[3].v}</span></div>}
      {t[4] && <div className="hud-telem t5">{t[4].l} <span className="v">{t[4].v}</span></div>}

      <div className="hud-core">
        <Orb size={120} state={thinking ? "thinking" : "idle"} />
      </div>
    </div>
  );
}
