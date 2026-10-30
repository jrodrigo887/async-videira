import type { Setlist } from "../types.ts";

/** Payload do Videira como chega pela rede: campos opcionais e tipos frouxos. */
export interface RawSetlistDetail {
  setlistId?: string | number;
  id?: string | number;
  title?: string | null;
  eventAt?: string | null;
  items?: Array<{
    position?: number | string | null;
    songId?: string | number | null;
    title?: string | null;
    artist?: string | null;
    externalId?: string | number | null;
  }>;
}

/** Projeção do payload do Videira para o que o domínio usa. */
export function projectSetlist(detail: RawSetlistDetail): Setlist {
  return {
    setlistId: String(detail.setlistId ?? detail.id ?? ""),
    title: detail.title ?? "",
    eventAt: detail.eventAt ?? null,
    items: (detail.items ?? []).map((item) => ({
      position: Number(item.position ?? 0),
      songId: item.songId == null ? null : String(item.songId),
      title: item.title ?? "",
      artist: item.artist ?? "",
      externalId: item.externalId == null ? null : String(item.externalId),
    })),
  };
}

/** Culto pedido explicitamente, ou o primeiro publicado. */
export function selectSetlist<T extends { id: string | number }>(setlists: readonly T[], preferredId?: string | number | null): T | null {
  if (preferredId) return setlists.find((item) => String(item.id) === String(preferredId)) ?? null;
  return setlists[0] ?? null;
}
