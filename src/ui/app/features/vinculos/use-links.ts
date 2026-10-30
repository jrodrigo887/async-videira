import { call, safely } from "../../shared/api.ts";
import type { ConfirmResult, LinkConfirmation } from "../../shared/api.ts";

/** Ações de vínculo: depois de mudar, o culto é preparado de novo para refletir o novo plano. */
export function useLinks(prepare: () => Promise<void>) {
  async function confirmLinks(confirmations: LinkConfirmation[]): Promise<ConfirmResult> {
    const r = await safely(() => call("songLinks.confirmBatch", { confirmations }));
    if (!r.ok) return r;
    await prepare();
    return { ok: true, outcomes: r.data.outcomes };
  }

  async function removeLink(videiraSongId: string) {
    const r = await safely(() => call("songLinks.remove", { videiraSongId }));
    if (r.ok) await prepare();
    return r;
  }

  const openEditor = (videiraSongId: string) => safely(() => call("song.openEditor", { videiraSongId }));
  const awaitCreated = () => safely(() => call("song.awaitCreated"));

  return { confirmLinks, removeLink, openEditor, awaitCreated };
}
