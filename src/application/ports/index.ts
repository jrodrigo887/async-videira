// Contratos (portas) que a camada de aplicação espera. Só tipos: nenhuma implementação aqui.
// Adaptadores ficam em src/adapters/*; a montagem em src/composition/*.

import type { DomainEvent } from "../../domain/events.ts";
import type { AuditData, AuditEntry } from "../../domain/audit/audit-entry.ts";
import type { HelpTopic } from "../../domain/help/help-topics.ts";
import type { RawSetlistDetail } from "../../domain/setlist/setlist.ts";
import type {
  AppState, CatalogSong, Credentials, Hash, HolyricsPing, HolyricsSchedule, Settings,
} from "../../domain/types.ts";

export interface PublishedSetlistSummary {
  id: string | number;
  title?: string | null;
  eventAt?: string | null;
}

export interface LinkRequest {
  songId: string;
  externalId: string;
  externalTitle: string;
  externalArtist: string | null;
}

export interface LinkResult {
  index: number;
  outcome: string;
}

/** Relatório como o servidor o recebe (o fingerprint já vai como texto). */
export type WireReport = Record<string, unknown>;

export interface VideiraGateway {
  listPublishedSetlists(query?: { date?: string }): Promise<{ setlists: PublishedSetlistSummary[] }>;
  getPublishedSetlist(setlistId: string | number): Promise<RawSetlistDetail>;
  sendSyncReport(report: WireReport): Promise<unknown>;
  confirmSongLinks(items: LinkRequest[]): Promise<LinkResult[]>;
  removeSongLink(songId: string): Promise<{ removed: boolean }>;
  getSongLyrics(songId: string): Promise<string | null>;
}

export type CreatedSongResult =
  | { state: "created"; song: CatalogSong }
  | { state: "ambiguous"; songs: CatalogSong[] }
  | { state: "not-found"; song: null };

export interface HolyricsGateway {
  ping(): Promise<HolyricsPing>;
  getCatalog(): Promise<CatalogSong[]>;
  getCurrentSchedule(): Promise<HolyricsSchedule | null>;
  getPlaylist(): Promise<Array<{ id?: string | number } | string | number>>;
  applyOrder(ids: string[]): Promise<unknown>;
  openSongEditor(song: { title: string; artist: string; lyrics?: string }): Promise<{ opened: boolean }>;
  awaitCreatedSong(before: CatalogSong[], song: { title: string; artist: string }): Promise<CreatedSongResult>;
}

/** Estado local: `load` recupera arquivo corrompido; `save` é atômico e recusa credenciais. */
export interface StateRepository {
  load(): Promise<AppState>;
  save(state: Partial<AppState>): Promise<AppState>;
}

export interface Clock {
  now(): Date;
}

export type EventHandler = (event: DomainEvent) => void | Promise<void>;

/** Lado de quem só publica fatos. */
export interface EventPublisher {
  publish(event: DomainEvent): Promise<void>;
}

/** Bus em processo: assinantes observam; nunca decidem. */
export interface EventBus extends EventPublisher {
  subscribe(handler: EventHandler): () => void;
}

/** Publicação é opcional: sem bus (CLI, testes) os use cases funcionam igual. */
export interface EventDeps {
  events?: EventPublisher | undefined;
}

/** Dependências dos casos de uso do culto (preparar, aplicar, vínculos, editor de música). */
export interface Deps extends EventDeps {
  videira: VideiraGateway;
  holyrics: HolyricsGateway;
  state: StateRepository;
  clock: Clock;
  hash: Hash;
}

export interface SettingsRepository {
  read(): Promise<Settings>;
  write(settings: Settings): Promise<Settings>;
}

export interface Vault {
  read(): Promise<Credentials>;
  write(credentials: Credentials): Promise<void>;
}

export interface AuditLog {
  append(event: string, data?: AuditData): Promise<void>;
  list(): Promise<AuditEntry[]>;
}

export interface HelpCatalog {
  topics(): Promise<HelpTopic[]>;
}

export interface ExternalLinks {
  open(url: string): Promise<void> | void;
}

export interface GatewayOptions {
  baseUrl: string;
  token?: string | undefined;
}

/** Cria clientes sob demanda, com o endereço/token que a tela está testando. */
export interface GatewayFactories {
  holyrics(options: GatewayOptions): Pick<HolyricsGateway, "ping">;
  videira(options: GatewayOptions): Pick<VideiraGateway, "listPublishedSetlists">;
}

/** Recortes de dependências: cada caso de uso declara só o que usa (ISP). */
export interface SettingsDeps extends EventDeps {
  settings: SettingsRepository;
  allowLoopbackVideira?: boolean | undefined;
}
export interface CredentialDeps extends EventDeps { vault: Vault }
export interface ConnectionDeps extends SettingsDeps, CredentialDeps { gateways: GatewayFactories }
export interface HelpDeps { help: HelpCatalog }
export interface ExternalLinkDeps { externalLinks: ExternalLinks }
export type SyncAdapter = Pick<HolyricsGateway, "getPlaylist" | "applyOrder">;
