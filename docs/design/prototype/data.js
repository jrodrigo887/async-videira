/*
 * Dados fictícios do protótipo, nas formas de docs/design/view-models.md.
 * Base: fixtures/sync-core-cases.json (Mil Graus / A Boa Parte / É Ele, IDs reais da
 * validação ao vivo) e discovery/live-validation.md (É Ele × "E Ele", repetição A-E-A,
 * playlist "Temporario" com 7 itens). Músicas extras são inventadas para ambiguidade/ausência.
 */
(function () {
  const MIL_GRAUS = { id: "1792693855267", title: "Mil Graus", artist: "Renascer Praise" };
  const A_BOA_PARTE = { id: "1792693855255", title: "A Boa Parte", artist: "Florianópolis House Of Prayer e Nívea Soares" };
  const E_ELE = { id: "1792693855260", title: "E Ele", artist: "DROPS" };
  const SANTO_A = { id: "1745011200000", title: "Santo", artist: "Fernandinho", createdAt: "2025-04-19" };
  const SANTO_B = { id: "1781222400000", title: "Santo", artist: "Fernandinho", createdAt: "2026-06-12" };

  const PLAYLIST_BEFORE = [
    { id: "1792693855001", title: "Bondade de Deus", artist: "Isaias Saad" },
    { id: "1792693855002", title: "Lugar Secreto", artist: "Gabriela Rocha" },
    { id: "1792693855003", title: "Ousado Amor", artist: "Isaias Saad" },
    { id: "1792693855004", title: "Aquieta Minh'alma", artist: "Ministério Zoe" },
    { id: "1792693855005", title: "Grande é o Senhor", artist: "Adhemar de Campos" },
    { id: "1792693855006", title: "Te Louvarei", artist: "Toque no Altar" },
    { id: "1792693855007", title: "Santo Espírito", artist: "Laura Souguellis" },
  ];

  const SETLIST_ORDERED = { id: "async-test-setlist-ordered", title: "Culto de domingo — manhã", eventAt: "2026-11-01T10:00:00-03:00", publishedBy: "Marta" };
  const SETLIST_NIGHT = { id: "async-test-setlist-night", title: "Culto de domingo — noite", eventAt: "2026-11-01T19:00:00-03:00", publishedBy: "Marta" };

  // Para testar o diálogo de substituição com 15 itens (?antes=15).
  const PLAYLIST_LONG = [...PLAYLIST_BEFORE, ...[
    ["Ninguém Explica Deus", "Preto no Branco"], ["Raridade", "Anderson Freire"], ["Me Atraiu", "Gabriela Rocha"], ["Tua Graça Me Basta", "Toque no Altar"],
    ["Vida Aos Sepulcros", "Bethel Music"], ["Hosana", "Hillsong em Português"], ["Rendido Estou", "Aline Barros"], ["Deus de Milagres", "Ministério Zoe"],
  ].map(([title, artist], i) => ({ id: String(1792693855020 + i), title, artist }))];

  // Dois tipos de destino (view-models.md §3): culto da agenda (tem data) ou playlist temporária (sem data).
  // Na validação ao vivo, sem Plan, GetCurrentSchedule devolveu type "temporary", name "Temporário" e datetime = agora;
  // o núcleo deve entregar datetime null nesse caso para a UI não comparar a hora atual com a data do setlist.
  const DEST_OK = { kind: "schedule", name: "Culto de Domingo 01/11", type: "service", datetime: "2026-11-01T10:00:00-03:00", currentItems: PLAYLIST_BEFORE, check: "match" };
  const DEST_TEMP = { kind: "temporary", name: "Temporário", type: "temporary", datetime: null, currentItems: PLAYLIST_BEFORE, check: "unverifiable" };
  const DEST_OLD = { kind: "schedule", name: "Culto de Domingo 25/10", type: "service", datetime: "2026-10-25T10:00:00-03:00", currentItems: PLAYLIST_BEFORE, check: "dateMismatch" };

  const ready = (position, songId, song, h) => ({ position, songId, song, state: "ready", holyrics: h, matchedBy: "externalId", suggestion: null, candidates: [], repeatOf: null, staleLink: null });

  const item = {
    milGraus: (p) => ready(p, "fixture-videira-mil-graus", { title: "Mil Graus", artist: "Renascer Praise" }, MIL_GRAUS),
    aBoaParte: (p) => ready(p, "fixture-videira-a-boa-parte", { title: "A Boa Parte", artist: "Florianópolis House Of Prayer e Nívea Soares" }, A_BOA_PARTE),
    eEleReady: (p) => ready(p, "fixture-videira-e-ele", { title: "É Ele", artist: "DROPS" }, E_ELE),
    // Caso real: sem vínculo, "É Ele" × "E Ele" casam após normalização exata (SearchLyrics trazia também "Vida Aos Sepulcros").
    eEleSuggest: (p) => ({ position: p, songId: "fixture-videira-e-ele", song: { title: "É Ele", artist: "DROPS" }, state: "needsLink", holyrics: null, matchedBy: null, suggestion: { ...E_ELE, reason: "exactTitleArtist" }, candidates: [], repeatOf: null, staleLink: null }),
    aBoaParteRepeat: (p, of) => ({ position: p, songId: "fixture-videira-a-boa-parte", song: { title: "A Boa Parte", artist: "Florianópolis House Of Prayer e Nívea Soares" }, state: "repeated", holyrics: A_BOA_PARTE, matchedBy: "externalId", suggestion: null, candidates: [], repeatOf: of, staleLink: null }),
    santoAmbiguous: (p) => ({ position: p, songId: "fixture-videira-santo", song: { title: "Santo", artist: "Fernandinho" }, state: "chooseVersion", holyrics: null, matchedBy: null, suggestion: null, candidates: [SANTO_A, SANTO_B], repeatOf: null, staleLink: null }),
    promessasMissing: (p) => ({ position: p, songId: "fixture-videira-deus-de-promessas", song: { title: "Deus de Promessas", artist: "Davi Sacer" }, state: "missing", holyrics: null, matchedBy: null, suggestion: null, candidates: [], repeatOf: null, staleLink: null, // Resultado simulado de song.awaitCreated depois que o operador salva no Holyrics.
      simCreated: {
        song: { id: "1793000000001", title: "Deus de Promessas", artist: "Davi Sacer" },
        ambiguous: [
          { id: "1793000000001", title: "Deus de Promessas", artist: "Davi Sacer", savedAt: "09:31" },
          { id: "1793000000002", title: "Deus de Promessas", artist: "Davi Sacer", savedAt: "09:33" },
        ],
      } }),
    milGrausStale: (p) => ({ position: p, songId: "fixture-videira-mil-graus", song: { title: "Mil Graus", artist: "Renascer Praise" }, state: "needsLink", holyrics: null, matchedBy: null, suggestion: { id: "1801000000004", title: "Mil Graus", artist: "Renascer Praise", reason: "exactTitleArtist" }, candidates: [], repeatOf: null, staleLink: { oldId: "1792693855267", reason: "notInLibrary" } }),
    // Lote: exatos únicos (a normalização ignora acento e caixa: "Grande é o Senhor" = "Grande É o Senhor").
    exact: (p, songId, title, artist, h) => ({ position: p, songId, song: { title, artist }, state: "needsLink", holyrics: null, matchedBy: null, suggestion: { ...h, reason: "exactTitleArtist" }, candidates: [], repeatOf: null, staleLink: null }),
    // Aproximado: a pontuação é preservada na normalização, então ’ × ' não é exato → sempre individual.
    aquietaApprox: (p) => ({ position: p, songId: "fixture-videira-aquieta", song: { title: "Aquieta Minh’alma", artist: "Ministério Zoe" }, state: "chooseVersion", approximate: true, holyrics: null, matchedBy: null, suggestion: null, candidates: [{ id: "1792693855004", title: "Aquieta Minh'alma", artist: "Ministério Zoe", createdAt: "2026-10-04", reason: "similar" }], repeatOf: null, staleLink: null }),
    aBoaParteStale: (p) => ({ position: p, songId: "fixture-videira-a-boa-parte", song: { title: "A Boa Parte", artist: "Florianópolis House Of Prayer e Nívea Soares" }, state: "needsLink", holyrics: null, matchedBy: null, suggestion: { id: "1801000000011", title: "A Boa Parte", artist: "Florianópolis House Of Prayer e Nívea Soares", reason: "exactTitleArtist" }, candidates: [], repeatOf: null, staleLink: { oldId: "1792693855255", reason: "notInLibrary" } }),
  };

  const connOk = {
    holyrics: { status: "ok", detail: { version: "2.30.0", port: 8091, songCount: 29, plan: "none" } },
    videira: { status: "ok", detail: { organizationName: "Igreja Videira Centro" } },
  };

  const base = (over) => ({
    configured: true,
    connections: structuredClone(connOk),
    setlist: SETLIST_ORDERED,
    setlistChoices: [SETLIST_ORDERED],
    setlistSource: "live",
    setlistCachedAt: null,
    destination: DEST_OK,
    items: [],
    alreadyApplied: false,
    error: null,
    reconciliation: { active: false, affectsCurrentSetlist: false, count: 0 },
    pendingReports: [],
    applyOutcome: "verified",
    ...over,
  });

  const scenarios = {
    feliz: {
      label: "Caso real: É Ele precisa de vínculo",
      group: "Fluxo principal",
      data: () => base({ items: [item.milGraus(0), item.aBoaParte(1), item.eEleSuggest(2)] }),
    },
    pronto: {
      label: "Tudo pronto (3 de 3)",
      group: "Fluxo principal",
      data: () => base({ items: [item.milGraus(0), item.aBoaParte(1), item.eEleReady(2)] }),
    },
    repetida: {
      label: "Setlist com música repetida (A, É, A)",
      group: "Fluxo principal",
      data: () => base({ items: [item.aBoaParte(0), item.eEleReady(1), item.aBoaParteRepeat(2, 0)] }),
    },
    ausente: {
      label: "Música ausente → abrir editor do Holyrics",
      group: "Fluxo principal",
      data: () => base({ items: [item.milGraus(0), item.promessasMissing(1), item.aBoaParte(2)] }),
    },
    temporaria: {
      label: "Destino = playlist temporária (caso real sem Plan)",
      group: "Fluxo principal",
      data: () => base({ destination: DEST_TEMP, items: [item.milGraus(0), item.aBoaParte(1), item.eEleReady(2)] }),
    },
    pendencias: {
      label: "Lista longa: ambígua + ausente + sugestão (7)",
      group: "Fluxo principal",
      data: () => base({ setlistChoices: [SETLIST_ORDERED, SETLIST_NIGHT], items: [
        item.milGraus(0), item.santoAmbiguous(1), item.aBoaParte(2), item.eEleSuggest(3),
        ready(4, "fixture-videira-bondade", { title: "Bondade de Deus", artist: "Isaias Saad" }, PLAYLIST_BEFORE[0]),
        item.promessasMissing(5),
        ready(6, "fixture-videira-lugar-secreto", { title: "Lugar Secreto", artist: "Gabriela Rocha" }, PLAYLIST_BEFORE[1]),
      ] }),
    },
    lote: {
      label: "Vínculos em lote (4 exatos + 2 individuais)",
      group: "Fluxo principal",
      data: () => base({ items: [
        item.milGraus(0),
        item.eEleSuggest(1),
        item.exact(2, "fixture-videira-bondade", "Bondade de Deus", "Isaias Saad", PLAYLIST_BEFORE[0]),
        item.exact(3, "fixture-videira-lugar-secreto", "Lugar Secreto", "Gabriela Rocha", PLAYLIST_BEFORE[1]),
        item.exact(4, "fixture-videira-grande", "Grande É o Senhor", "Adhemar de Campos", PLAYLIST_BEFORE[4]),
        item.aquietaApprox(5),
        item.santoAmbiguous(6),
      ] }),
    },
    loteVazio: {
      label: "Lote vazio (só decisões individuais)",
      group: "Fluxo principal",
      data: () => base({ items: [item.milGraus(0), item.aquietaApprox(1), item.santoAmbiguous(2), item.promessasMissing(3)] }),
    },
    jaIgual: {
      label: "Playlist já está igual",
      group: "Fluxo principal",
      data: () => base({ alreadyApplied: true, destination: { ...DEST_OK, currentItems: [MIL_GRAUS, A_BOA_PARTE, E_ELE] }, items: [item.milGraus(0), item.aBoaParte(1), item.eEleReady(2)] }),
    },
    primeira: {
      label: "Primeira execução (pareamento)",
      group: "Configuração",
      data: () => base({ configured: false, items: [item.milGraus(0), item.aBoaParte(1), item.eEleSuggest(2)] }),
    },
    reconciliacao: {
      label: "Troca de PC: biblioteca mudou",
      group: "Configuração",
      data: () => base({
        connections: { ...structuredClone(connOk), holyrics: { status: "ok", detail: { version: "2.30.0", port: 8091, songCount: 31, plan: "none" } } },
        reconciliation: { active: true, affectsCurrentSetlist: true, count: 17 },
        items: [item.milGrausStale(0), item.aBoaParteStale(1), item.eEleSuggest(2)],
      }),
    },
    falhaRestaurada: {
      label: "Holyrics fecha no meio → restaurado",
      group: "Falhas ao publicar",
      data: () => base({ applyOutcome: "failedRestored", items: [item.milGraus(0), item.aBoaParte(1), item.eEleReady(2)] }),
    },
    falhaSemRestaurar: {
      label: "Falha e não conseguiu restaurar",
      group: "Falhas ao publicar",
      data: () => base({ applyOutcome: "failedNotRestored", items: [item.milGraus(0), item.aBoaParte(1), item.eEleReady(2)] }),
    },
    holyricsFechado: {
      label: "Holyrics fechado",
      group: "Erros comuns",
      data: () => base({ connections: { ...structuredClone(connOk), holyrics: { status: "unreachable", detail: { port: 8091 } } }, destination: null, items: [], error: { code: "HOLYRICS_UNREACHABLE", severity: "error", retryable: true, params: {}, technical: { message: "connect ECONNREFUSED 127.0.0.1:8091" } } }),
    },
    tokenHolyrics: {
      label: "Token do Holyrics inválido",
      group: "Erros comuns",
      data: () => base({ connections: { ...structuredClone(connOk), holyrics: { status: "tokenInvalid", detail: { port: 8091 } } }, destination: null, items: [], error: { code: "HOLYRICS_TOKEN_INVALID", severity: "error", retryable: false, params: {}, technical: { message: "401 invalid token" } } }),
    },
    permissao: {
      label: "Falta permissão no Holyrics",
      group: "Erros comuns",
      data: () => base({ connections: { ...structuredClone(connOk), holyrics: { status: "permissionMissing", detail: { port: 8091 } } }, destination: null, items: [], error: { code: "HOLYRICS_PERMISSION_MISSING", severity: "error", retryable: true, params: { missing: ["GetCurrentSchedule"] }, technical: { message: "401 unauthorized action: GetCurrentSchedule" } } }),
    },
    semInternet: {
      label: "Sem internet (usa setlist baixado)",
      group: "Erros comuns",
      data: () => base({ connections: { ...structuredClone(connOk), videira: { status: "offline", detail: { organizationName: "Igreja Videira Centro" } } }, setlistSource: "cache", setlistCachedAt: "2026-10-31T21:14:00-03:00", pendingReports: [{ id: "q-1", setlistTitle: "Culto de domingo — noite (25/10)", createdAt: "2026-10-25T18:52:00-03:00", attempts: 4, lastError: "VIDEIRA_OFFLINE" }], items: [item.milGraus(0), item.aBoaParte(1), item.eEleReady(2)] }),
    },
    tokenVideira: {
      label: "Token do Videira revogado",
      group: "Erros comuns",
      data: () => base({ connections: { ...structuredClone(connOk), videira: { status: "tokenInvalid", detail: {} } }, setlist: null, items: [], error: { code: "VIDEIRA_TOKEN_INVALID", severity: "error", retryable: false, params: {}, technical: { message: "401 Unauthorized" } } }),
    },
    dataErrada: {
      label: "Culto de outra data selecionado",
      group: "Erros comuns",
      data: () => base({ destination: DEST_OLD, items: [item.milGraus(0), item.aBoaParte(1), item.eEleReady(2)] }),
    },
    semSetlist: {
      label: "Nenhum setlist publicado",
      group: "Erros comuns",
      data: () => base({ setlist: null, items: [], error: { code: "VIDEIRA_NO_SETLIST", severity: "info", retryable: true, params: {}, technical: null } }),
    },
  };

  const reconciliation = {
    summary: { unchanged: 12, exactPair: 14, multiple: 1, noPair: 2 },
    previousLibrary: { baseDir: "C:\\Users\\midia\\Holyrics", songCount: 29 },
    currentLibrary: { baseDir: "D:\\Holyrics", songCount: 31 },
    batch: [
      { songId: "fixture-videira-mil-graus", videira: { title: "Mil Graus", artist: "Renascer Praise" }, oldId: "1792693855267", new: { id: "1801000000004", title: "Mil Graus", artist: "Renascer Praise" }, inCurrentSetlist: true },
      { songId: "fixture-videira-a-boa-parte", videira: { title: "A Boa Parte", artist: "Florianópolis House Of Prayer e Nívea Soares" }, oldId: "1792693855255", new: { id: "1801000000011", title: "A Boa Parte", artist: "Florianópolis House Of Prayer e Nívea Soares" }, inCurrentSetlist: true },
      ...[
        ["Bondade de Deus", "Isaias Saad"], ["Lugar Secreto", "Gabriela Rocha"], ["Ousado Amor", "Isaias Saad"], ["Aquieta Minh'alma", "Ministério Zoe"],
        ["Grande é o Senhor", "Adhemar de Campos"], ["Te Louvarei", "Toque no Altar"], ["Santo Espírito", "Laura Souguellis"], ["Vida Aos Sepulcros", "Bethel Music"],
        ["Ninguém Explica Deus", "Preto no Branco"], ["Raridade", "Anderson Freire"], ["Me Atraiu", "Gabriela Rocha"], ["Tua Graça Me Basta", "Toque no Altar"],
      ].map(([title, artist], i) => ({ songId: `fixture-videira-${i}`, videira: { title, artist }, oldId: String(1792693855100 + i), new: { id: String(1801000000100 + i), title, artist }, inCurrentSetlist: false })),
    ],
    individual: [
      { songId: "fixture-videira-santo", videira: { title: "Santo", artist: "Fernandinho" }, oldId: "1745011200000", candidates: [{ id: "1801000000201", title: "Santo", artist: "Fernandinho", createdAt: "2026-10-28" }, { id: "1801000000202", title: "Santo", artist: "Fernandinho", createdAt: "2026-10-28" }] },
    ],
    noPair: [
      { songId: "fixture-videira-x1", videira: { title: "Hosana", artist: "Hillsong em Português" }, oldId: "1792693855301" },
      { songId: "fixture-videira-x2", videira: { title: "Rendido Estou", artist: "Aline Barros" }, oldId: "1792693855302" },
    ],
  };

  const history = [
    { id: "r-3", at: "2026-10-25T18:52:00-03:00", setlistTitle: "Culto de domingo — noite", destinationName: "Culto de Domingo 25/10 19h", outcome: "verified", songCount: 5, reportStatus: "sent" },
    { id: "r-2", at: "2026-10-25T09:40:00-03:00", setlistTitle: "Culto de domingo — manhã", destinationName: "Culto de Domingo 25/10", outcome: "partial", songCount: 4, reportStatus: "sent", note: "1 música ficou de fora" },
    { id: "r-1", at: "2026-10-18T09:47:00-03:00", setlistTitle: "Culto de domingo — manhã", destinationName: "Culto de Domingo 18/10", outcome: "failedRestored", songCount: 4, reportStatus: "sent", note: "Holyrics parou de responder; playlist restaurada" },
  ];

  const links = [
    { title: "Mil Graus", artist: "Renascer Praise", holyricsId: "1792693855267", since: "2026-10-04", source: "batch" },
    { title: "A Boa Parte", artist: "Florianópolis House Of Prayer e Nívea Soares", holyricsId: "1792693855255", since: "2026-10-04", source: "batch" },
    { title: "Bondade de Deus", artist: "Isaias Saad", holyricsId: "1792693855001", since: "2026-10-11", source: "individual" },
    { title: "Lugar Secreto", artist: "Gabriela Rocha", holyricsId: "1792693855002", since: "2026-10-11", source: "batch" },
  ];

  const REQUIRED_PERMISSIONS = ["GetVersion", "GetTokenInfo", "GetAPIServerInfo", "GetHolyricsPlanInfo", "SearchLyrics", "GetSongs", "GetLyrics", "GetLyricsPlaylist", "AddLyricsToPlaylist", "RemoveFromLyricsPlaylist", "GetCurrentSchedule"];

  window.PROTO_DATA = { scenarios, reconciliation, history, links, REQUIRED_PERMISSIONS, PLAYLIST_BEFORE, PLAYLIST_LONG };
})();
