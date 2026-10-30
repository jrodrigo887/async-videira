import { publish } from "../services/events.ts";
import type { SettingsDeps } from "../ports/index.ts";
import type { Settings } from "../../domain/types.ts";
import { validateEndpoints } from "../../domain/settings/endpoints.ts";

export const getSettings = (deps: SettingsDeps) => deps.settings.read();

/**
 * Atualiza só os campos conhecidos e recusa endereços fora da política (Holyrics em loopback, Videira oficial).
 */
export async function updateSettings(deps: SettingsDeps, patch: Partial<Record<keyof Settings, unknown>>) {
  const current = await deps.settings.read();
  const next = {
    ...current,
    ...(typeof patch.holyricsUrl === "string" ? { holyricsUrl: patch.holyricsUrl } : {}),
    ...(typeof patch.videiraApiBase === "string" ? { videiraApiBase: patch.videiraApiBase } : {}),
    ...(typeof patch.firstRunDone === "boolean" ? { firstRunDone: patch.firstRunDone } : {}),
  };
  validateEndpoints(next, { allowLoopbackHttp: deps.allowLoopbackVideira });
  const saved = await deps.settings.write(next);
  await publish(deps, { type: "SettingsUpdated" });
  return saved;
}
