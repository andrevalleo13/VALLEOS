"use client";
import { useEffect, useState } from "react";
import { play } from "@/lib/sounds";

const KEY = "valleos-booted";

export function BootSequence() {
  const [show, setShow] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem(KEY) === "1") return;
    sessionStorage.setItem(KEY, "1");
    setShow(true);
    play("boot");
    const t1 = setTimeout(() => setClosing(true), 1500);
    const t2 = setTimeout(() => setShow(false), 2050);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  if (!show) return null;

  return (
    <div className={`boot${closing ? " boot-closing" : ""}`} aria-hidden>
      <div className="boot-stage">
        <span className="boot-ring boot-ring-3" />
        <span className="boot-ring boot-ring-2" />
        <span className="boot-ring boot-ring-1" />
        <span className="boot-orb" />
        <span className="boot-spark" />
      </div>
      <p className="boot-word">
        VALLE<span>·</span>
      </p>
    </div>
  );
}
