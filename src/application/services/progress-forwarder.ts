import type { OperationKind } from "../../domain/events.ts";
import type { EventHandler } from "../ports/index.ts";

/** O que a UI recebe de progresso: só a operação e a etapa, nunca IDs, códigos de erro ou dados do culto. */
export interface ProgressMessage {
  operation: OperationKind;
  step: "started" | "succeeded" | "failed" | (string & {});
}

/** Evento de domínio → mensagem de progresso (ou null se não interessa à UI). */
export function progressFor(event: Parameters<EventHandler>[0]): ProgressMessage | null {
  switch (event.type) {
    case "OperationStarted": return { operation: event.operation, step: "started" };
    case "OperationPhaseChanged": return { operation: event.operation, step: event.phase };
    case "OperationSucceeded": return { operation: event.operation, step: "succeeded" };
    case "OperationFailed": return { operation: event.operation, step: "failed" };
    default: return null;
  }
}

/** Assinante do bus que entrega o progresso a quem o exibe (a janela, pelo IPC). */
export const createProgressForwarder = (send: (message: ProgressMessage) => void): EventHandler => (event) => {
  const message = progressFor(event);
  if (message) send(message);
};
