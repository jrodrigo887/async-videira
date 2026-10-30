// Tipos do domínio. Só tipos: nenhuma dependência de Node, rede ou Electron.
import type { ApplyJournal } from "./events.ts";

/** Música do Holyrics como o domínio a enxerga (sem o item de sistema, tudo string). */
export interface CatalogSong {
  id: string;
  title: string;
  artist: string;
}

export interface SetlistItem {
  position: number;
  songId: string | null;
  title: string;
  artist: string;
  externalId: string | null;
}

export interface Setlist {
  setlistId: string;
  title: string;
  eventAt: string | null;
  items: SetlistItem[];
}

export interface Suggestion {
  id: string;
  title: string;
  artist: string | null;
}

export type SongMatch =
  | { kind: "resolved"; id: string; via: "externalId" }
  | { kind: "suggested"; stale: string | null; candidates: Suggestion[] }
  | { kind: "ambiguous"; stale?: string | null; candidates: string[] }
  | { kind: "absent"; stale: string | null; candidates: string[] };

export type PlanItemStatus = "resolved" | "repeated" | "ambiguous" | "absent";

export interface PlanItem {
  position: number;
  songId: string | null;
  title: string;
  artist: string | null;
  status: PlanItemStatus;
  holyricsId?: string;
  matchedBy?: "externalId";
  candidates?: string[];
  suggestions?: Suggestion[];
  /** O vínculo do Videira aponta para um ID que esta biblioteca Holyrics não tem mais. */
  staleExternalId?: string;
}

export interface SyncPlan {
  itemResults: PlanItem[];
  targetIds: string[];
  hasRepeated: boolean;
  mutates: boolean;
}

export type SyncStatus = "OK" | "PARTIAL" | "FAILED";
export type ReportOutcome = "added" | "unchanged" | "duplicate" | "skipped" | "failed";

export interface ReportItem {
  songId: string | null;
  position: number;
  outcome: ReportOutcome;
}

export interface SyncOutcome {
  status: SyncStatus;
  applied: boolean;
  verified: boolean;
  plan: SyncPlan;
  reportItems: ReportItem[];
  actualIds?: string[];
  error?: string;
  errorCode?: string;
  restored?: boolean;
  restorationError?: string | null;
}

/** Destino (playlist/culto selecionado no Holyrics) reduzido ao que identifica uma troca. */
export interface ScheduleIdentity {
  type: string | null;
  name: string | null;
  datetime: string | null;
  eventId: string | null;
}

export interface LibraryFingerprint {
  baseDir: string | null;
  platform: string | null;
  ip_list: string[] | string;
  idsHash: string;
}

/** Hash determinístico (SHA-256 sobre JSON canônico), injetado para o domínio não importar node:crypto. */
export type Hash = (value: unknown) => string;

export interface Preparation {
  setlistId: string;
  title: string;
  preparedAt: string;
  setlistHash: string;
  catalogHash: string;
  libraryFingerprint: LibraryFingerprint;
  schedule: ScheduleIdentity;
  plan: SyncPlan;
}

export interface SyncReport {
  setlistId: string;
  status: SyncStatus;
  holyricsVersion: string;
  items: ReportItem[];
  libraryFingerprint: LibraryFingerprint | string;
}

export interface PendingReport {
  report: SyncReport;
  queuedAt: string;
  attemptCount: number;
  lastAttemptAt?: string;
}

export interface MigrationEntry {
  at: string;
  songId: string;
  oldExternalId: string;
  newExternalId: string | null;
  action: "relinked" | "unlinked";
}

export interface MigrationState {
  status: string;
  previousFingerprint: LibraryFingerprint | null;
  history: MigrationEntry[];
}

/** Estado local versionado (cache + fila + migração). É descartável: a verdade está no Videira e no Holyrics. */
export interface AppState {
  schemaVersion: number;
  updatedAt: string;
  cache: {
    catalog: { items: CatalogSong[]; fingerprint: LibraryFingerprint; readAt: string } | null;
    setlist: { value: Setlist; fetchedAt: string } | null;
  };
  prepared: Preparation | null;
  pendingReports: PendingReport[];
  migration: MigrationState;
  /** Apply em andamento/encerrado; um `started` sem `done` indica interrupção (ver RecoverInterruptedApply). */
  journal?: ApplyJournal | null;
  lastRun?: {
    setlistId: string;
    status: SyncStatus;
    verified: boolean;
    errorCode?: string;
    restored?: boolean;
    finishedAt: string;
  };
  checksum?: string;
}

/** Resposta do Holyrics ao reconhecimento (versão, plano, servidor). Campos opcionais: variam por versão. */
export interface HolyricsPing {
  version?: { version?: string; baseDir?: string; platform?: string; ip_list?: string[] };
  tokenInfo?: unknown;
  plan?: { type?: string };
  apiServer?: { ip_list?: string[] };
}

export interface HolyricsSchedule {
  type?: string | null;
  name?: string | null;
  datetime?: string | null;
  metadata?: { event?: { id?: string | number | null } };
}

/** Preferências não secretas do app. */
export interface Settings {
  holyricsUrl: string;
  videiraApiBase: string;
  firstRunDone: boolean;
}

export type CredentialTarget = "holyrics" | "videira";
export type Credentials = Partial<Record<CredentialTarget, string>>;
