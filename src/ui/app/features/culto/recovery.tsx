import React, { useState } from "react";
import type { RecoveryReport } from "../../../../application/use-cases/recover-interrupted-apply.ts";
import { call, codeOf } from "../../shared/api.ts";
import { Callout } from "../../shared/ui.tsx";

export type Interrupted = Extract<RecoveryReport, { status: "interrupted" }>;

const WHERE: Record<Interrupted["playlist"], string> = {
  target: "A playlist do Holyrics está como o setlist pedia, mas a publicação não chegou a ser confirmada.",
  backup: "A playlist do Holyrics voltou a ser a de antes da publicação.",
  other: "A playlist do Holyrics não está nem como antes nem como o setlist pedia.",
};

/** Aviso na abertura: a última publicação foi interrompida no meio. Restaurar ou dispensar é decisão do operador. */
export function RecoveryBanner({ report, onDone }: { report: Interrupted; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function run(action: "restore" | "dismiss") {
    setBusy(true); setError("");
    try { await call("worship.recover", { action }); onDone(); }
    catch (e) { setError(codeOf(e) === "HOLYRICS_NOT_RUNNING" ? "O Holyrics não respondeu. Abra-o e tente de novo." : "Não foi possível concluir. Confira a playlist no Holyrics."); }
    finally { setBusy(false); }
  }
  return (
    <Callout
      tone="danger"
      icon="alert"
      role="alert"
      title="A última publicação foi interrompida"
      actions={<>
        {report.canRestore && report.playlist !== "backup" && <button className="ds-button btn-sm" disabled={busy} onClick={() => run("restore")}>Restaurar a playlist anterior</button>}
        <button className="ds-button-secondary btn-sm" disabled={busy} onClick={() => run("dismiss")}>{report.playlist === "backup" ? "Entendi" : "Manter como está"}</button>
      </>}
    >
      {WHERE[report.playlist]} {error}
    </Callout>
  );
}
