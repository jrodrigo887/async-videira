import type { createDesktopContainer } from "../../../composition/desktop-container.ts";

/** O que os comandos IPC enxergam: casos de uso já ligados aos adaptadores (composition/desktop-container). */
export type DesktopContext = ReturnType<typeof createDesktopContainer>;

export type Payload = Record<string, unknown>;

/** Erro seguro para o renderer: só códigos e chaves, nunca mensagem ou stack do erro original. */
export interface CoreError {
  code: string;
  messageKey: string;
  retryable: boolean;
  helpTopicId?: string;
}

export interface IpcEnvelope {
  requestId: string;
  command: string;
  payload?: unknown;
}

export type IpcResponse =
  | { requestId: string; ok: true; data: unknown }
  | { requestId: string; ok: false; error: CoreError };

/**
 * Um comando do manifesto: nome, validação da entrada e handler.
 * `Input` é o que `validate` devolve (e o handler recebe); sem `validate`, é o payload cru.
 */
export interface IpcCommand<Input = Payload, Context = DesktopContext> {
  name: string;
  validate?: (payload: Payload) => Input;
  handler: (ctx: Context, input: Input) => unknown;
  onError?: (ctx: Context, payload: Payload, code: string) => unknown;
}

/** Forma apagada de `IpcCommand`, para guardar comandos de entradas diferentes na mesma lista. */
export interface RegisteredCommand<Context = DesktopContext> {
  name: string;
  validate?: (payload: Payload) => unknown;
  // `any` só aqui: cada comando já foi checado contra o próprio `Input` em `defineCommand`.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: (ctx: Context, input: any) => unknown;
  onError?: (ctx: Context, payload: Payload, code: string) => unknown;
}

export const defineCommand = <Input = Payload, Context = DesktopContext>(command: IpcCommand<Input, Context>): RegisteredCommand<Context> => command;
