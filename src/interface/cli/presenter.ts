import { helpTopicForError } from "../../domain/shared/errors.ts";
import type { SyncPlan } from "../../domain/types.ts";
import type { AppliedWorship } from "../../application/use-cases/apply-worship.ts";
import type { PreparedWorship } from "../../application/use-cases/prepare-worship.ts";

const pad = (index: number) => String(index + 1).padStart(2, "0");

function planLines(plan: SyncPlan): string[] {
  return plan.itemResults.map((item, index) => {
    const label = `${pad(index)}. [${item.status}] ${item.title}${item.artist ? ` — ${item.artist}` : ""}`;
    if (item.status === "resolved") return `${label} (Holyrics ${item.holyricsId}; ${item.matchedBy})`;
    if (item.suggestions?.length) {
      return `${label}; sugestão para revisão: ${item.suggestions.map((candidate) => `${candidate.title} — ${candidate.artist ?? "(sem artista)"} [${candidate.id}]`).join(" | ")}`;
    }
    if (item.candidates?.length) return `${label}; candidatos: ${item.candidates.join(", ")}`;
    return label;
  });
}

/** Texto do dry-run (CLI e aba "Publicar" do app). */
export function formatPreparation({ preparation, plan, activePlan }: Pick<PreparedWorship, "preparation" | "plan" | "activePlan">): string {
  const { setlist, destination } = preparation;
  const lines = [
    `Preparação: ${setlist.title} (${setlist.id})`,
    `Destino selecionado: ${destination.name ?? destination.type ?? "desconhecido"}`,
    ...planLines(plan),
    `Dry-run concluído: ${plan.targetIds.length} ID(s) resolvido(s), ${plan.hasRepeated ? "há repetidos" : "sem repetidos"}; nenhuma escrita feita.`,
  ];
  if (activePlan) lines.push("Aviso: o Holyrics informou plano ativo; este fluxo usa somente a playlist selecionada.");
  return `${lines.join("\n")}\n`;
}

/** Texto do resultado da aplicação. */
export function formatApplication({ title, result, reportQueued }: Pick<AppliedWorship, "title" | "result" | "reportQueued">): string {
  const lines = [`Aplicação: ${title} — ${result.status}${result.verified ? " (releitura confirmada)" : " (não verificada)"}`];
  if (result.status === "FAILED" && result.error) {
    lines.push(`Falha: ${result.error}`);
    const topicId = helpTopicForError(result.errorCode ?? "");
    if (topicId) lines.push(`Ajuda: ${topicId}`);
  }
  result.reportItems.forEach((item, index) => lines.push(`${pad(index)}. ${item.outcome}`));
  if (reportQueued) lines.push("sync-report não enviado; enfileirado no estado local.");
  return `${lines.join("\n")}\n`;
}

/** Texto de erro para stderr. */
export function formatError(error: unknown): string {
  const message = error instanceof Error ? error.message : "Falha inesperada.";
  const rawCode = (error as { code?: unknown } | null)?.code;
  const code = typeof rawCode === "string" ? rawCode : undefined;
  const lines = [`Erro${code ? ` [${code}]` : ""}: ${message}`];
  const topicId = code ? helpTopicForError(code) : null;
  if (topicId) lines.push(`Ajuda: ${topicId}`);
  return `${lines.join("\n")}\n`;
}
