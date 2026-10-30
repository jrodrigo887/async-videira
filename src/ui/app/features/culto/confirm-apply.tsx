import React, { useEffect, useRef } from "react";
import type { PreparationView } from "../../../../application/use-cases/prepare-worship.ts";
import { plural, songState } from "../../shared/ui.tsx";

export function ConfirmApply({ prep, onCancel, onConfirm }: { prep: PreparationView; onCancel: () => void; onConfirm: () => void }) {
  const left = prep.items.length - prep.targetCount - prep.items.filter((i) => songState(i) === "repeated").length;
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => { ref.current?.focus(); const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel(); window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey); }, [onCancel]);
  return (
    <div className="overlay">
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
        <h2 className="dialog-title" id="confirm-title">Substituir a playlist do Holyrics?</h2>
        <div className="stack-sm" style={{ marginTop: ".75rem" }}>
          <p>A playlist de <strong>{prep.destination.name ?? "playlist temporária"}</strong>, hoje com {plural(prep.destination.currentCount, "música", "músicas")}, passará a ter {plural(prep.targetCount, "música", "músicas")} na ordem do setlist.</p>
          {left > 0 && <p className="sm"><strong>{plural(left, "música fica", "músicas ficam")} de fora</strong> porque ainda precisam de você.</p>}
          <p className="sm muted">Confira no Holyrics se este é o culto selecionado. O app relê a playlist depois e tenta restaurar a anterior se algo falhar.</p>
        </div>
        <div className="dialog-actions">
          <button className="ds-button-secondary" onClick={onCancel}>Cancelar</button>
          <button className="ds-button" ref={ref} onClick={onConfirm}>Substituir playlist</button>
        </div>
      </div>
    </div>
  );
}
