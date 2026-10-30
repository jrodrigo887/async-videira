import type { CatalogSong, Hash, HolyricsSchedule, LibraryFingerprint, Preparation, ScheduleIdentity, Setlist, SyncPlan } from "../types.ts";

/** Identidade do destino (playlist/culto selecionado no Holyrics) usada para detectar troca entre preparar e aplicar. */
export function scheduleIdentity(schedule: HolyricsSchedule | null | undefined): ScheduleIdentity {
  return {
    type: schedule?.type ?? null,
    name: schedule?.name ?? null,
    datetime: schedule?.datetime ?? null,
    eventId: schedule?.metadata?.event?.id == null ? null : String(schedule.metadata.event.id),
  };
}

/** `hash` é injetado (o domínio não importa node:crypto). */
export function createPreparation({ chosenId, setlist, catalog, fingerprint, schedule, plan, preparedAt, hash }: {
  chosenId: string | number;
  setlist: Setlist;
  catalog: CatalogSong[];
  fingerprint: LibraryFingerprint;
  schedule: HolyricsSchedule | null | undefined;
  plan: SyncPlan;
  preparedAt: string;
  hash: Hash;
}): Preparation {
  return {
    setlistId: setlist.setlistId || String(chosenId),
    title: setlist.title,
    preparedAt,
    setlistHash: hash(setlist),
    catalogHash: hash(catalog),
    libraryFingerprint: fingerprint,
    schedule: scheduleIdentity(schedule),
    plan,
  };
}

/** A preparação só vale enquanto setlist, catálogo, biblioteca e destino continuam como foram preparados. */
export function isStale(
  prepared: Preparation,
  current: { setlist: Setlist; catalog: CatalogSong[]; fingerprint: LibraryFingerprint; schedule: HolyricsSchedule | null | undefined },
  hash: Hash,
): boolean {
  return (
    hash(current.setlist) !== prepared.setlistHash ||
    hash(current.catalog) !== prepared.catalogHash ||
    hash(current.fingerprint) !== hash(prepared.libraryFingerprint) ||
    hash(scheduleIdentity(current.schedule)) !== hash(prepared.schedule)
  );
}
