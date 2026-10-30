import { coded } from "../../../domain/shared/errors.ts";
import type { IpcEnvelope, IpcResponse, Payload, RegisteredCommand } from "./types.ts";
import { toCoreError } from "./error-mapper.ts";

const MAX_PAYLOAD_CHARS = 1024 * 1024;
const isPlainObject = (value: unknown): value is Payload => value !== null && typeof value === "object" && !Array.isArray(value);

/**
 * Despacha envelopes `{ requestId, command, payload }` para o manifesto de comandos.
 * Só comandos do manifesto existem (allowlist); cada um valida a própria entrada. Falhas viram `CoreError`.
 * Checar quem enviou (o renderer certo) é com o host Electron, antes de chegar aqui.
 */
export function createIpcRouter<Context>({ commands, ctx, onFailure }: {
  commands: readonly RegisteredCommand<Context>[];
  ctx: Context;
  onFailure?: (error: unknown, command: string) => void;
}) {
  const byName = new Map(commands.map((command): [string, RegisteredCommand<Context>] => [command.name, command]));

  async function handle(raw: unknown): Promise<IpcResponse> {
    const envelope = raw as Partial<IpcEnvelope> | null | undefined;
    if (!envelope || typeof envelope.requestId !== "string" || typeof envelope.command !== "string") {
      throw new Error("Requisição IPC inválida.");
    }
    const { requestId } = envelope;
    const payload = (envelope.payload ?? {}) as Payload;
    const command = byName.get(envelope.command);
    const commandName = envelope.command;
    try {
      if (!command) throw coded("INVALID_REQUEST", "Comando IPC não permitido.");
      if (!isPlainObject(payload) || JSON.stringify(payload).length > MAX_PAYLOAD_CHARS) throw coded("INVALID_REQUEST", "Entrada inválida.");
      const input = command.validate ? command.validate(payload) : payload;
      return { requestId, ok: true, data: await command.handler(ctx, input) };
    } catch (error) {
      onFailure?.(error, commandName);
      const coreError = toCoreError(error);
      try { await command?.onError?.(ctx, payload, coreError.code); } catch {}
      return { requestId, ok: false, error: coreError };
    }
  }

  return { handle, names: [...byName.keys()] };
}
