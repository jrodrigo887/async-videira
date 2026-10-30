import type { DomainEvent, OperationKind } from "../../domain/events.ts";
import type { CredentialTarget } from "../../domain/types.ts";
import { errorCode } from "../../domain/shared/errors.ts";
import type { EventDeps } from "../ports/index.ts";

/** Publica se houver bus; sem bus é no-op. */
export const publish = (deps: EventDeps, event: DomainEvent): Promise<void> => deps.events?.publish(event) ?? Promise.resolve();

export interface OperationMeta {
  operation: OperationKind;
  target?: CredentialTarget | undefined;
}

/** O que vai em `OperationSucceeded` além do tipo e do alvo. */
export type SuccessDetails = Partial<Pick<Extract<DomainEvent, { type: "OperationSucceeded" }>, "status" | "count">>;

/**
 * Envolve uma operação do operador (preparar, aplicar, testar conexão…) com o ciclo
 * Started → (PhaseChanged…) → Succeeded | Failed. Quem escuta (auditoria, progresso) não faz parte do use case.
 */
export async function runOperation<T>(deps: EventDeps, meta: OperationMeta, work: () => Promise<T>, details: (result: T) => SuccessDetails = () => ({})): Promise<T> {
  const base = { operation: meta.operation, ...(meta.target ? { target: meta.target } : {}) };
  await publish(deps, { type: "OperationStarted", ...base });
  let result: T;
  try {
    result = await work();
  } catch (error) {
    await publish(deps, { type: "OperationFailed", ...base, code: errorCode(error) });
    throw error;
  }
  await publish(deps, { type: "OperationSucceeded", ...base, ...details(result) });
  return result;
}
