"use client";
import { useEffect } from "react";
import { X } from "lucide-react";

export function Modal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className={wide ? "modal-card modal-card-wide" : "modal-card"} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="eyebrow">{title}</span>
          <button className="tb-btn" style={{ width: 28, height: 28 }} onClick={onClose} aria-label="Cerrar">
            <X size={15} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="modal-field">
      <span className="modal-field-label">{label}</span>
      {children}
    </label>
  );
}
