import type { CoreError } from "./types.ts";
import { errorCode, errorInfo } from "../../../domain/shared/errors.ts";

/** Erro qualquer → `CoreError` seguro para o renderer. Nunca expõe mensagem, stack nem detalhes do erro original. */
export function toCoreError(error: unknown): CoreError {
  const { code, messageKey, retryable, helpTopicId } = errorInfo(errorCode(error));
  return { code, messageKey, retryable, ...(helpTopicId ? { helpTopicId } : {}) };
}
