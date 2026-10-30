import { coded } from "../../../domain/shared/errors.ts";
import { isCredentialTarget } from "../../../domain/settings/endpoints.ts";
import { defineCommand } from "./types.ts";
import type { Payload, RegisteredCommand } from "./types.ts";
import { runOperation } from "../../../application/services/events.ts";
import { formatApplication, formatPreparation } from "../../cli/presenter.ts";

// Manifesto de comandos IPC: o ÚNICO lugar onde nomes, validação de entrada e handlers são declarados.
// Adicionar um comando é adicionar uma entrada aqui (o router, o preload e a UI não mudam).
// `ctx` vem de composition/desktop-container.ts.

const invalid = () => coded("INVALID_REQUEST", "Entrada inválida.");
const str = (value: unknown, max = 64): string => { if (typeof value !== "string" || !value || value.length > max) throw invalid(); return value; };
const optionalStr = (value: unknown, max = 200): string | undefined => (value === undefined ? undefined : str(value, max));
const SETLIST_ID = /^[\w-]{1,100}$/;
const setlistIdOf = (payload: Payload): string | undefined => (typeof payload.setlistId === "string" && SETLIST_ID.test(payload.setlistId) ? payload.setlistId : undefined);

export const commands: readonly RegisteredCommand[] = [
  defineCommand({ name: "settings.get", handler: (ctx) => ctx.getSettings() }),
  defineCommand({
    name: "settings.update",
    handler: (ctx, patch) => ctx.updateSettings(patch),
  }),
  defineCommand({
    name: "service.credentials.set",
    validate: (payload) => ({ target: payload.target, token: payload.token }),
    handler: (ctx, input) => ctx.setCredential(input),
  }),
  defineCommand({ name: "service.credentials.status", handler: (ctx) => ctx.credentialStatus() }),
  defineCommand({ name: "logs.list", handler: (ctx) => ctx.audit.list() }),
  defineCommand({
    name: "connection.check",
    validate: (payload) => {
      const target = payload.target;
      if (!isCredentialTarget(target)) throw invalid();
      return { target, token: payload.token as string | undefined, url: payload.url };
    },
    handler: (ctx, input) => runOperation(ctx, { operation: "connection", target: input.target }, () => ctx.checkConnection(input), (result) => ("count" in result && typeof result.count === "number" ? { count: result.count } : {})),
  }),
  // Verificação silenciosa com o que está salvo (usada ao abrir o app): não entra no log de atividade.
  defineCommand({
    name: "connection.probe",
    validate: (payload) => {
      if (!isCredentialTarget(payload.target)) throw invalid();
      return { target: payload.target };
    },
    handler: (ctx, input) => ctx.checkConnection(input),
  }),
  defineCommand({
    name: "songLinks.confirmBatch",
    validate: (payload) => {
      if (!Array.isArray(payload.confirmations)) throw invalid();
      return { confirmations: payload.confirmations.map((entry) => ({ videiraSongId: str(entry?.videiraSongId), holyricsSongId: str(entry?.holyricsSongId) })) };
    },
    handler: async (ctx, input) => {
      const app = await ctx.worship();
      return app.confirmSongLinks({ confirmations: input.confirmations, created: ctx.editorSession.created });
    },
  }),
  defineCommand({
    name: "songLinks.remove",
    validate: (payload) => ({ videiraSongId: str(payload.videiraSongId) }),
    handler: async (ctx, input) => {
      const app = await ctx.worship();
      return app.removeSongLink(input);
    },
  }),
  defineCommand({
    name: "song.openEditor",
    validate: (payload) => ({ videiraSongId: str(payload.videiraSongId) }),
    handler: async (ctx, input) => (await ctx.worship()).openSongEditor({ ...input, session: ctx.editorSession }),
  }),
  defineCommand({
    name: "song.awaitCreated",
    handler: async (ctx) => (await ctx.worship()).awaitCreatedSong({ session: ctx.editorSession }),
  }),
  defineCommand({
    name: "worship.prepare",
    validate: (payload) => ({ setlistId: setlistIdOf(payload) }),
    handler: (ctx, input) => runOperation(
      ctx,
      { operation: "prepare" },
      async () => (await ctx.worship()).prepareWorship(input),
      () => ({ status: "prepared" as const }),
    ).then((prepared) => ({ text: formatPreparation(prepared), status: "prepared", preparation: prepared.preparation })),
  }),
  defineCommand({
    name: "worship.apply",
    validate: (payload) => ({ setlistId: setlistIdOf(payload) }),
    handler: async (ctx, input) => {
      const text = await runOperation(ctx, { operation: "apply" }, async () => {
        const applied = await (await ctx.worship()).applyWorship(input);
        const text = formatApplication(applied);
        // Uma aplicação que terminou FAILED é, para a UI, uma falha: o texto detalha o que aconteceu.
        if (applied.result.status === "FAILED") throw Object.assign(new Error(text.slice(0, 4000)), { code: applied.result.errorCode });
        return text;
      }, () => ({ status: "complete" as const }));
      return { text, status: "complete", preparation: null };
    },
  }),
  defineCommand({
    name: "worship.recover",
    validate: (payload) => {
      const action = payload.action ?? "inspect";
      if (action !== "inspect" && action !== "restore" && action !== "dismiss") throw invalid();
      return { action } as { action: "inspect" | "restore" | "dismiss" };
    },
    handler: async (ctx, input) => (await ctx.worship()).recoverInterruptedApply(input),
  }),
  defineCommand({
    name: "help.list",
    validate: (payload) => ({ publico: optionalStr(payload.publico), categoria: optionalStr(payload.categoria) }),
    handler: (ctx, input) => ctx.listHelp(input),
  }),
  defineCommand({
    name: "help.get",
    validate: (payload) => ({ topicId: str(payload.topicId, 100) }),
    handler: (ctx, input) => ctx.getHelp(input),
  }),
  defineCommand({
    name: "help.search",
    validate: (payload) => ({ query: String(payload.query ?? "").slice(0, 200), limit: Math.min(Number(payload.limit) || 10, 50) }),
    handler: (ctx, input) => ctx.searchHelp(input),
  }),
  defineCommand({
    name: "externalLink.open",
    validate: (payload) => ({ url: str(payload.url, 2048) }),
    handler: (ctx, input) => ctx.openExternalLink(input),
  }),
];
