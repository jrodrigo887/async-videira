/*
 * async-videira — protótipo navegável (HTML/CSS/JS estático, sem build).
 * Toda a "integração" é simulada a partir de data.js. Textos seguem docs/design/microcopy.md.
 */
(function () {
  "use strict";
  const D = window.PROTO_DATA;
  const $app = document.getElementById("app");
  const $dialog = document.getElementById("dialog-root");
  const $proto = document.getElementById("proto-root");
  const $live = document.getElementById("live");

  // ---------------------------------------------------------------- estado
  const S = {
    scenario: "feliz",
    screen: "culto",
    data: null,
    dialog: null,
    theme: load("theme", "system"),
    fontScale: Number(load("fontScale", "1")),
    onb: null,
    review: { sel: {} },
    flash: null,
    progress: null,
    result: null,
    recon: { sel: {}, picks: {}, done: false },
    sessionRuns: [],
    sessionLinks: [],
    loading: false,
    protoOpen: false,
    linking: false,
    settingsMsg: null,
    reminder: { enabled: true, time: "08:00" },
    tray: { startWithOs: true, closeToTray: true },
    holyricsReal: false,
    holyricsUrl: "http://127.0.0.1:8091",
    askAfterMs: 4000,
    editorCooldownUntil: 0,
    realMsg: null,
    help: { topic: "comecar", query: "", copyMsg: null, focusTitle: false },
    helpReturn: null,
  };
  const newMissingDialog = (pos) => ({ type: "missing", pos, editor: null, errorCode: null, reread: null, tries: 0, search: null, found: null, candidates: [], pick: null });
  let lastScreen = null;
  let dialogWasOpen = false;
  let dialogReturnKey = null;

  function load(key, fallback) { try { return localStorage.getItem("av-proto-" + key) ?? fallback; } catch { return fallback; } }
  function save(key, value) { try { localStorage.setItem("av-proto-" + key, value); } catch { /* sem storage */ } }

  function loadScenario(key) {
    S.scenario = key;
    S.data = D.scenarios[key].data();
    S.screen = S.data.configured ? "culto" : "onboarding";
    S.dialog = null;
    S.flash = null;
    S.progress = null;
    S.result = null;
    S.review = { sel: {} };
    S.recon = { sel: {}, picks: {}, done: false };
    S.onb = { step: "welcome", hToken: "", vToken: "", hTest: null, vTest: null, hTries: 0, err: {}, showH: false, showV: false, testing: null };
    S.settingsMsg = null;
    S.songView = null;
    S.readyOpen = false;
  }

  // ---------------------------------------------------------------- utilidades
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const fmtDay = (iso) => iso ? new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" }).format(new Date(iso)) : "";
  const fmtTime = (iso) => iso ? new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(iso)) : "";
  const fmtShort = (iso) => iso ? new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(iso)) : "";
  const fmtDate = (iso) => iso ? new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(iso)) : "";
  const nowIso = () => new Date().toISOString();
  const announce = (msg) => { $live.textContent = ""; setTimeout(() => { $live.textContent = msg; }, 30); };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const DEST_OK = () => D.scenarios.pronto.data().destination;
  const snapshot = () => ({ items: structuredClone(S.data.items), links: [...S.sessionLinks] });

  const ICONS = {
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    x: '<path d="M7 7l10 10M17 7L7 17"/>',
    alert: '<path d="M12 3.5l9 16H3z"/><path d="M12 10v4.5M12 17.5v.01"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.5v.01"/>',
    link: '<path d="M10 14a4.5 4.5 0 006.4 0l3-3a4.5 4.5 0 00-6.4-6.4l-1 1"/><path d="M14 10a4.5 4.5 0 00-6.4 0l-3 3a4.5 4.5 0 006.4 6.4l1-1"/>',
    diamond: '<path d="M12 3l9 9-9 9-9-9z"/>',
    repeat: '<path d="M17 3l3 3-3 3"/><path d="M4 11V9a3 3 0 013-3h13"/><path d="M7 21l-3-3 3-3"/><path d="M20 13v2a3 3 0 01-3 3H4"/>',
    music: '<path d="M9 18V5l11-2v13"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>',
    history: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    settings: '<path d="M4 7h9M17 7h3M4 12h3M11 12h9M4 17h11M19 17h1"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="17" r="2"/>',
    refresh: '<path d="M20 12a8 8 0 11-2.4-5.7L20 8.5"/><path d="M20 3.5v5h-5"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2"/>',
    send: '<path d="M4 12l16-8-6 16-2.5-6.5z"/>',
    external: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5"/>',
    shield: '<path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z"/>',
    undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 010 12h-3"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 114 2c-.9.6-1.5 1.1-1.5 2.2v.3M12 17v.01"/>',
  };
  const icon = (name, cls = "icon") => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ""}</svg>`;

  const STATE_META = {
    ready: { label: "Pronta", many: "prontas", tone: "ok", icon: "check" },
    needsLink: { label: "Confirmar vínculo", many: "para confirmar vínculo", tone: "info", icon: "link" },
    chooseVersion: { label: "Escolher versão", many: "para escolher versão", tone: "warn", icon: "diamond" },
    missing: { label: "Não está no Holyrics", many: "fora do Holyrics", tone: "danger", icon: "x" },
    repeated: { label: "Repetida — entra 1 vez", many: "repetidas", tone: "neutral", icon: "repeat" },
  };
  const chip = (state, extra = "") => { const m = STATE_META[state]; return `<span class="status-chip status-chip--${m.tone}">${icon(m.icon)}${esc(extra || m.label)}</span>`; };
  const toneChip = (tone, ic, label) => `<span class="status-chip status-chip--${tone}">${icon(ic)}${esc(label)}</span>`;
  const callout = (tone, ic, title, body, actions = "", role = "") => `
    <div class="callout callout--${tone}" ${role ? `role="${role}"` : ""}>
      ${icon(ic, "icon-lg")}
      <div class="grow"><h2>${title}</h2>${body ? `<p>${body}</p>` : ""}${actions ? `<div class="actions">${actions}</div>` : ""}</div>
    </div>`;

  // Ajuda contextual (docs/design/help-map.md): sempre um botão de texto, nunca abre nada fora do app.
  const helpLink = (id, label = "Ver ajuda sobre isto") => `<button class="ds-link help-link" data-act="help" data-arg="${id}">${icon("help")}${label}</button>`;

  // ---------------------------------------------------------------- derivados
  function summary(items) {
    const c = { total: items.length, ready: 0, needsLink: 0, chooseVersion: 0, missing: 0, repeated: 0 };
    items.forEach((i) => { c[i.state]++; });
    return c;
  }
  const holyricsDown = () => S.data.connections.holyrics.status !== "ok";
  const targetItems = () => S.data.items.filter((i) => i.state === "ready");
  const leftOut = () => S.data.items.filter((i) => ["needsLink", "chooseVersion", "missing"].includes(i.state));
  // Temporária não tem data para conferir; culto da agenda com data diferente é suspeito. Ambos exigem reconhecimento.
  const destSuspect = () => S.data.destination && (S.data.destination.kind === "temporary" || S.data.destination.check !== "match");
  const isTemp = () => S.data.destination && S.data.destination.kind === "temporary";
  const destLabel = () => isTemp() ? "a playlist temporária do Holyrics" : `a playlist de “${esc(S.data.destination.name)}”`;

  function primaryForCulto() {
    const d = S.data;
    if (S.loading) return { label: "Preparando…", disabled: true, hint: "Lendo setlist e biblioteca do Holyrics…" };
    if (d.error && d.error.code === "VIDEIRA_NO_SETLIST") return { label: "Procurar de novo", act: "prepare", hint: "Nenhum setlist publicado para os próximos dias." };
    if (holyricsDown()) return { label: "Publicar no Holyrics", disabled: true, hint: "Precisa do Holyrics funcionando para publicar." };
    if (!d.setlist) return { label: "Publicar no Holyrics", disabled: true, hint: "Precisa do setlist do Videira Music." };
    const c = summary(d.items);
    if (c.needsLink + c.chooseVersion > 0) return { label: "Revisar pendências", act: "go", arg: "review", hint: `${plural(c.needsLink + c.chooseVersion + c.missing, "música precisa", "músicas precisam")} de você antes de publicar.` };
    if (c.ready === 0) return { label: "Publicar no Holyrics", disabled: true, hint: "Nenhuma música do setlist está no Holyrics ainda." };
    if (d.alreadyApplied) return { label: "Conferir de novo", act: "prepare", hint: `${icon("check")} A playlist do Holyrics já está igual ao setlist.` };
    if (c.missing > 0) return { label: "Publicar no Holyrics", act: "openConfirm", hint: `${plural(c.missing, "música vai", "músicas vão")} ficar de fora. Você confirma antes.` };
    return { label: "Publicar no Holyrics", act: "openConfirm", hint: `${destLabel().replace(/^a/, "A")} será substituída. Você confirma antes.` };
  }

  // ---------------------------------------------------------------- shell
  function render() {
    const theme = S.theme === "system" ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : S.theme;
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.setProperty("--font-scale", S.fontScale);

    const active = document.activeElement;
    const focusKey = active && active !== document.body ? keyOf(active) : null;

    $app.innerHTML = `
      <div class="app">
        <div class="titlebar" aria-hidden="true"><span>async-videira — Videira Music</span><span class="win-controls"><span>—</span><span>▢</span><span>✕</span></span></div>
        ${S.screen === "onboarding" ? renderOnboarding() : S.screen === "ajuda" && !S.data.configured ? renderHelp() : renderShell()}
      </div>`;
    $dialog.innerHTML = S.dialog ? renderDialog() : "";
    $proto.innerHTML = renderProto();

    // foco: troca de tela → h1; diálogo aberto → autofocus; senão preserva
    if (S.dialog && !dialogWasOpen) {
      dialogReturnKey = focusKey;
      const t = $dialog.querySelector("[data-autofocus]") || $dialog.querySelector("button, input, select");
      t && t.focus({ preventScroll: true }); // foco em Cancelar sem rolar o diálogo para baixo do título
    } else if (!S.dialog && dialogWasOpen) {
      restoreFocus(dialogReturnKey);
    } else if (S.screen !== lastScreen) {
      const h1 = $app.querySelector("h1");
      h1 && h1.focus({ preventScroll: true });
    } else {
      restoreFocus(focusKey);
    }
    if (S.screen === "ajuda" && S.help.focusTitle && !S.dialog) { S.help.focusTitle = false; const t = document.getElementById("help-title"); t && t.focus({ preventScroll: true }); const m = document.getElementById("main"); m && (m.scrollTop = 0); }
    dialogWasOpen = !!S.dialog;
    lastScreen = S.screen;
    document.body.style.overflow = S.dialog ? "hidden" : "";
  }
  function keyOf(el) {
    if (el.id) return "#" + CSS.escape(el.id);
    if (el.type === "radio" && el.name) return `input[name="${CSS.escape(el.name)}"][value="${CSS.escape(el.value)}"]`;
    if (el.dataset && el.dataset.change) return `[data-change="${el.dataset.change}"]${el.dataset.arg != null ? `[data-arg="${CSS.escape(el.dataset.arg)}"]` : ""}`;
    if (el.dataset && el.dataset.act) return `[data-act="${el.dataset.act}"]${el.dataset.arg != null ? `[data-arg="${CSS.escape(el.dataset.arg)}"]` : ""}`;
    return null;
  }
  function restoreFocus(key) {
    if (!key) return;
    const el = document.querySelector(key);
    if (el && !el.disabled) el.focus({ preventScroll: true });
  }

  function renderShell() {
    const d = S.data;
    const nav = [
      ["culto", "music", "Culto", 1],
      ["vinculos", "link", "Vínculos", 2],
      ["historico", "history", "Histórico", 3],
      ["ajustes", "settings", "Ajustes", 4],
      ["ajuda", "help", "Ajuda", "F1"],
    ];
    const current = ["review", "progress", "result"].includes(S.screen) ? "culto" : S.screen === "bandeja" ? "ajustes" : S.screen;
    const h = d.connections.holyrics, v = d.connections.videira;
    const hTone = h.status === "ok" ? "" : "danger";
    const hText = { ok: "conectado", unreachable: "não está respondendo", tokenInvalid: "token recusado", permissionMissing: "falta permissão" }[h.status] || h.status;
    const vTone = v.status === "ok" ? "" : v.status === "offline" ? "warn" : "danger";
    const vText = { ok: "conectado", offline: "sem internet", tokenInvalid: "token recusado" }[v.status] || v.status;
    const pending = d.pendingReports.length;
    const reconCount = d.reconciliation.active && !S.recon.done ? d.reconciliation.count : 0;

    return `
      <a class="skip-link ds-button" href="#main">Pular para o conteúdo</a>
      <div class="app-body">
        <nav class="app-nav" aria-label="Principal">
          <div class="brand"><span class="brand-mark" aria-hidden="true">V</span><span class="brand-text">async-videira<small>${esc(d.connections.videira.detail.organizationName || "Videira Music")}</small></span></div>
          ${nav.map(([k, ic, label, n]) => `
            <button class="nav-item" data-act="go" data-arg="${k}" ${current === k ? 'aria-current="page"' : ""} aria-label="${label}${k === "historico" && pending ? `, ${pending} pendentes` : ""}${k === "vinculos" && reconCount ? `, ${reconCount} para revisar` : ""}" title="${label} (${n === "F1" ? "F1" : `Ctrl+${n}`})"${n === "F1" ? ' aria-keyshortcuts="F1"' : ""}>
              ${icon(ic)}<span class="label">${label}</span>
              ${k === "historico" && pending ? `<span class="count" aria-hidden="true">${pending}</span>` : ""}
              ${k === "vinculos" && reconCount ? `<span class="count" aria-hidden="true">${reconCount}</span>` : ""}
            </button>`).join("")}
          <div class="nav-foot">v0.1.0 · protótipo</div>
        </nav>
        <div class="app-main">
          <div class="connbar" role="status" aria-label="Conexões">
            <button class="conn-pill ${hTone}" data-act="go" data-arg="ajustes"><span class="dot" aria-hidden="true"></span>Holyrics: ${hText}</button>
            <button class="conn-pill ${vTone}" data-act="go" data-arg="ajustes"><span class="dot" aria-hidden="true"></span>Videira Music: ${vText}</button>
          </div>
          ${renderScreen()}
        </div>
      </div>`;
  }

  function page(inner, bar = "") {
    return `<main id="main" class="content" tabindex="-1"><div class="content-inner stack">${inner}</div></main>${bar}`;
  }
  function actionBar(p, secondary = "") {
    return `<div class="action-bar">
      <span class="hint" id="primary-hint">${p.hint || ""}</span>
      ${secondary}
      <button class="ds-button" data-primary ${p.act ? `data-act="${p.act}"` : ""} ${p.arg ? `data-arg="${p.arg}"` : ""} ${p.disabled ? "disabled" : ""} aria-describedby="primary-hint">${esc(p.label)}${p.act && !p.disabled ? `<span class="sr-only"> (Ctrl+Enter)</span>` : ""}</button>
    </div>`;
  }

  function renderScreen() {
    switch (S.screen) {
      case "culto": return renderCulto();
      case "review": return renderReview();
      case "progress": return renderProgress();
      case "result": return renderResult();
      case "vinculos": return renderVinculos();
      case "historico": return renderHistorico();
      case "ajustes": return renderAjustes();
      case "bandeja": return renderBandeja();
      case "ajuda": return renderHelp();
      default: return page("<h1>?</h1>");
    }
  }

  // ---------------------------------------------------------------- T10 Ajuda (conteúdo em src/help/*.md → help-data.js)
  const MD = window.PROTO_HELP_MD;
  const HELP = ((window.PROTO_HELP && window.PROTO_HELP.topics) || []).slice();
  const HELP_BY_ID = Object.fromEntries(HELP.map((t) => [t.id, t]));
  const HELP_IDS = new Set(HELP.map((t) => t.id));
  const HELP_CATS = [["comecar", "Começar"], ["domingo", "Todo domingo"], ["problema", "Resolver problema"], ["tecnico", "Configuração técnica"]];
  const HELP_INDEX = HELP.map((t) => ({ id: t.id, title: MD.norm(`${t.titulo} ${t.palavrasChave.join(" ")}`), text: MD.norm(`${t.titulo} ${t.palavrasChave.join(" ")} ${MD.plain(t.body)}`) }));
  // Código de erro/estado → tópico. Fonte da verdade: docs/design/help-map.md
  const HELP_FOR_CODE = {
    HOLYRICS_UNREACHABLE: "configurar-holyrics", HOLYRICS_TOKEN_INVALID: "configurar-holyrics", HOLYRICS_PERMISSION_MISSING: "configurar-holyrics",
    VIDEIRA_TOKEN_INVALID: "configurar-videira", VIDEIRA_NO_SETLIST: "configurar-videira", VIDEIRA_OFFLINE: "problemas-comuns",
    EDITOR_ALREADY_OPEN: "musica-nao-esta-no-holyrics", EDITOR_UNSUPPORTED: "musica-nao-esta-no-holyrics", EDITOR_FAILED: "musica-nao-esta-no-holyrics", RATE_LIMITED: "musica-nao-esta-no-holyrics",
    DESTINATION_SUSPECT: "destino-playlist-temporaria", DESTINATION_CHANGED: "destino-playlist-temporaria", SETLIST_CHANGED: "problemas-comuns",
  };

  // F1: o tópico que explica o que está na tela agora.
  function contextTopic() {
    const g = S.dialog, d = S.data;
    if (g) {
      if (g.type === "missing") return g.errorCode && g.errorCode !== "HOLYRICS_UNREACHABLE" ? HELP_FOR_CODE[g.errorCode] : g.errorCode ? "configurar-holyrics" : "musica-nao-esta-no-holyrics";
      if (g.type === "choose") return "musica-ambigua-e-vinculos";
      if (g.type === "confirm") return d.destination && destSuspect() ? "destino-playlist-temporaria" : "rotina-de-domingo";
      if (g.type === "removeToken") return "seguranca-dos-tokens";
      return "problemas-comuns";
    }
    if (S.screen === "onboarding") return { holyrics: "configurar-holyrics", videira: "configurar-videira" }[S.onb.step] || "comecar";
    if (S.screen === "ajuda") return S.help.topic;
    if (d.error && HELP_FOR_CODE[d.error.code]) return HELP_FOR_CODE[d.error.code];
    if (S.screen === "culto" && d.destination && destSuspect()) return "destino-playlist-temporaria";
    return { culto: "rotina-de-domingo", review: "musica-ambigua-e-vinculos", vinculos: d.reconciliation.active ? "trocar-de-computador" : "musica-ambigua-e-vinculos", historico: "problemas-comuns", result: "problemas-comuns", ajustes: "seguranca-dos-tokens", bandeja: "rotina-de-domingo" }[S.screen] || "comecar";
  }

  // Diagnóstico para suporte (placeholder): versões e estados, nunca tokens.
  function supportInfo() {
    const h = S.data.connections.holyrics, v = S.data.connections.videira, hd = h.detail || {};
    const ua = navigator.userAgent, os = /Windows/.test(ua) ? "Windows" : /Mac/.test(ua) ? "macOS" : "outro";
    return [
      "async-videira 0.1.0 (protótipo)",
      `Sistema: ${os}`,
      `Holyrics: ${hd.version ? `versão ${hd.version}` : "versão desconhecida"} · porta ${hd.port || 8091} · ${hd.plan === "none" ? "sem Plan" : hd.plan ? "com Plan" : "Plan desconhecido"} · conexão: ${h.status}`,
      `Videira Music: conexão: ${v.status}`,
      `Último erro: ${S.data.error ? S.data.error.code : "nenhum"}`,
      `Tópico da ajuda: ${S.help.topic}`,
      "Tokens: não incluídos",
    ].join("\n");
  }

  function renderHelp() {
    const q = S.help.query.trim();
    const terms = MD.norm(q).split(/\s+/).filter(Boolean);
    const inTitle = (x) => terms.every((t) => x.title.includes(t));
    const hits = terms.length ? HELP_INDEX.filter((x) => terms.every((t) => x.text.includes(t))).sort((a, b) => inTitle(b) - inTitle(a)).map((x) => x.id) : null;
    const topic = HELP_BY_ID[S.help.topic] || HELP[0];
    const catLabel = (HELP_CATS.find(([k]) => k === topic.categoria) || [, ""])[1];
    const listItem = (t) => `<li><button class="help-topic" data-act="helpTopic" data-arg="${t.id}" ${t.id === topic.id ? 'aria-current="page"' : ""}><span class="grow">${esc(t.titulo)}</span>${t.publico === "tecnico" ? '<span class="xs subtle">Técnico</span>' : ""}</button></li>`;
    let list;
    if (hits) {
      list = hits.length ? `<h2 class="help-cat" id="cat-hits">Resultados</h2><ul class="help-topics" aria-labelledby="cat-hits">${hits.map((id) => listItem(HELP_BY_ID[id])).join("")}</ul>`
        : `<div class="help-empty"><p class="sm"><strong>Nada encontrado para “${esc(q)}”.</strong></p><p class="sm muted">Tente outra palavra, como “token”, “destino” ou “letra”.</p><p class="sm">${helpLink("problemas-comuns", "Ver problemas comuns")}</p></div>`;
    } else {
      list = HELP_CATS.map(([k, l]) => {
        const ts = HELP.filter((t) => t.categoria === k).sort((a, b) => a.ordem - b.ordem);
        return ts.length ? `<h2 class="help-cat" id="cat-${k}">${l}</h2><ul class="help-topics" aria-labelledby="cat-${k}">${ts.map(listItem).join("")}</ul>` : "";
      }).join("");
    }
    const r = MD.render(topic.body, HELP_IDS);
    const toc = r.toc.length > 1 ? `<nav class="help-toc" aria-label="Nesta página"><p class="help-cat">Nesta página</p><ul>${r.toc.map((s) => `<li><button class="ds-link" data-act="helpJump" data-arg="${s.id}">${esc(MD.plain(s.title).trim())}</button></li>`).join("")}</ul></nav>` : "";
    const related = topic.relacionados.filter((id) => HELP_BY_ID[id]).map((id) => `<li><button class="ds-link" data-act="helpTopic" data-arg="${id}">${esc(HELP_BY_ID[id].titulo)}</button></li>`).join("");
    const fb = load("help-fb-" + topic.id, "");
    const aud = topic.publico === "tecnico"
      ? `<span class="status-chip status-chip--neutral">${icon("settings")}<span class="sr-only">Público: </span>Técnico</span>`
      : `<span class="status-chip status-chip--info">${icon("music")}<span class="sr-only">Público: </span>Operador</span>`;
    const r0 = S.helpReturn;
    const back = r0 || !S.data.configured
      ? `<button class="ds-button-secondary" data-act="helpBack">${icon("back")}${(r0 ? r0.screen : "onboarding") === "onboarding" ? "Voltar à configuração" : r0.dialog ? "Voltar para onde estava" : "Voltar"}</button>` : "";
    const count = hits ? (hits.length ? plural(hits.length, "tópico encontrado", "tópicos encontrados") : "Nenhum tópico encontrado") : `${HELP.length} tópicos`;

    return page(`
      <div class="page-head"><div class="grow"><p class="ds-eyebrow">Funciona sem internet · F1</p><h1 class="ds-h1" tabindex="-1">Ajuda</h1>
        <p class="lead muted">Respostas curtas para o domingo e guias para quem configura.</p></div>${back}</div>
      <div class="field help-search" role="search"><label for="help-search">Procurar na ajuda</label>
        <div class="input-row"><input id="help-search" class="ds-input" type="search" autocomplete="off" spellcheck="false" data-input="helpSearch" value="${esc(S.help.query)}" placeholder="Ex.: token, destino, letra" aria-describedby="help-count" aria-controls="help-nav">${q ? `<button class="ds-button-secondary" data-act="helpClear">Limpar</button>` : ""}</div>
        <p class="xs subtle" id="help-count" aria-live="polite" style="font-weight:400">${count}</p></div>
      <div class="help-layout">
        <nav class="help-nav" id="help-nav" aria-label="Tópicos da ajuda">${list}</nav>
        <article class="ds-card help-reader" aria-labelledby="help-title">
          <div class="row-wrap">${aud}<span class="xs subtle" style="font-weight:400">${esc(catLabel)}</span></div>
          <h2 class="ds-h2 help-title" id="help-title" tabindex="-1">${esc(topic.titulo)}</h2>
          <div class="help-body">${toc}<div class="md">${r.html}</div></div>
          ${related ? `<section class="help-related" aria-labelledby="help-rel"><h3 id="help-rel">Veja também</h3><ul>${related}</ul></section>` : ""}
          <div class="help-foot">
            <div class="help-fb" role="group" aria-labelledby="fb-q"><span id="fb-q" class="sm"><strong>Esta resposta ajudou?</strong></span>
              <button class="ds-button-secondary btn-sm" data-act="helpFb" data-arg="yes" aria-pressed="${fb === "yes"}">${fb === "yes" ? icon("check") : ""}Sim</button>
              <button class="ds-button-secondary btn-sm" data-act="helpFb" data-arg="no" aria-pressed="${fb === "no"}">${fb === "no" ? icon("check") : ""}Não</button>
              <span class="xs subtle" style="font-weight:400" role="status">${fb === "yes" ? "Obrigado! " : fb === "no" ? "Obrigado. Veja “Problemas comuns” ou copie as informações para suporte. " : ""}A resposta fica só neste computador; nada é enviado.</span></div>
            <div class="help-support"><button class="ds-button-secondary btn-sm" data-act="helpCopy">${icon("copy")}Copiar informações para suporte</button>
              ${S.help.copyMsg ? `<span class="xs" role="status">${esc(S.help.copyMsg)}</span>` : ""}
              <details class="sm" data-toggle="helpDiagOpen" ${S.helpDiagOpen ? "open" : ""}><summary>O que é copiado</summary><pre class="ds-card-muted mono help-diag">${esc(supportInfo())}</pre><p class="xs subtle" style="font-weight:400">Versões e estado das conexões. Os tokens nunca entram.</p></details></div>
          </div>
        </article>
      </div>`);
  }

  // ---------------------------------------------------------------- T1 Culto
  function renderFlash() {
    if (!S.flash) return "";
    const f = S.flash;
    return callout(f.tone || "ok", f.icon || "check", esc(f.title), f.body ? esc(f.body) : "", f.undo ? `<button class="ds-button-secondary btn-sm" data-act="undoFlash">${icon("undo")}Desfazer</button>` : "", "status");
  }

  function renderCulto() {
    const d = S.data;
    const err = d.error;
    let banners = renderFlash();

    if (err && err.code === "HOLYRICS_UNREACHABLE") {
      banners += callout("danger", "x", "O Holyrics não está respondendo", "Abra o Holyrics neste computador. Se ele já está aberto, confira <strong>Arquivo → Configurações → API Server → Ativar (local)</strong>. Depois de ativar, espere uns 15 segundos.", `<button class="ds-button btn-sm" data-act="retryHolyrics">${icon("refresh")}Tentar de novo</button>${helpLink("configurar-holyrics")}${techDetails(err)}`, "alert");
    } else if (err && err.code === "HOLYRICS_TOKEN_INVALID") {
      banners += callout("danger", "x", "O Holyrics não aceita mais o token", "Ele pode ter sido apagado em <strong>Gerenciar permissões</strong> no Holyrics. Crie um novo e cole em Ajustes.", `<button class="ds-button btn-sm" data-act="go" data-arg="ajustes">Trocar token</button>${helpLink("configurar-holyrics")}${techDetails(err)}`, "alert");
    } else if (err && err.code === "HOLYRICS_PERMISSION_MISSING") {
      banners += callout("danger", "shield", "Falta permissão no Holyrics", `Abrimos um pedido no Holyrics: clique em <strong>Permitir</strong> na janela que apareceu lá. Falta: <code class="mono">${esc(err.params.missing.join(", "))}</code>.`, `<button class="ds-button btn-sm" data-act="retryHolyrics">${icon("refresh")}Verificar de novo</button>${helpLink("configurar-holyrics")}`, "alert");
    } else if (err && err.code === "VIDEIRA_TOKEN_INVALID") {
      banners += callout("danger", "x", "O Videira Music recusou o token", "Ele pode ter sido revogado. Peça um novo a quem administra a igreja no Videira Music e cole em Ajustes.", `<button class="ds-button btn-sm" data-act="go" data-arg="ajustes">Trocar token</button>${helpLink("configurar-videira")}${techDetails(err)}`, "alert");
    }
    if (!err && d.connections.holyrics.status === "notConfigured") {
      banners += callout("danger", "x", "Falta o token do Holyrics", "Sem ele o app não lê a biblioteca nem muda a playlist.", `<button class="ds-button btn-sm" data-act="swapToken" data-arg="holyrics">Colar token</button>`, "alert");
    }
    if (!err && d.connections.videira.status === "notConfigured") {
      banners += callout("warn", "alert", "Falta o token do Videira Music", "Sem ele o app não baixa setlists novos.", `<button class="ds-button-secondary btn-sm" data-act="swapToken" data-arg="videira">Colar token</button>`);
    }
    if (d.setlistSource === "cache") {
      banners += callout("warn", "alert", "Sem conexão com o Videira Music", `Usando o setlist baixado ${esc(fmtDay(d.setlistCachedAt))}, às ${esc(fmtTime(d.setlistCachedAt))}. Se ele mudou depois, a mudança não aparece aqui. O aviso ao Videira será enviado quando a internet voltar.`, `<button class="ds-button-secondary btn-sm" data-act="retryVideira">${icon("refresh")}Tentar de novo</button>`);
    }
    if (d.reconciliation.active && !S.recon.done) {
      banners += callout("info", "info", "A biblioteca de músicas do Holyrics mudou", `Parece que o Holyrics foi reinstalado ou as músicas foram importadas de novo. ${d.reconciliation.affectsCurrentSetlist ? `${plural(d.items.filter((i) => i.staleLink).length, "música deste culto precisa", "músicas deste culto precisam")} ser vinculadas outra vez.` : "Isso não afeta o culto de domingo."} Nenhum vínculo antigo é apagado.`, `<button class="ds-button-secondary btn-sm" data-act="go" data-arg="vinculos">Revisar vínculos</button>${helpLink("trocar-de-computador")}`);
    }

    if (err && err.code === "VIDEIRA_NO_SETLIST") {
      return page(`
        <div class="page-head"><div><p class="ds-eyebrow">Próximo culto</p><h1 class="ds-h1" tabindex="-1">Nenhum culto publicado ainda</h1>
        <p class="lead muted">Quando o setlist de domingo for publicado no Videira Music, ele aparece aqui.</p></div></div>
        ${banners}
        <div class="ds-card-muted">Quem publica é a liderança de louvor, no Videira Music. O app procura de novo sozinho no domingo às ${esc(S.reminder.time)}. ${helpLink("configurar-videira", "Por que o setlist não aparece?")}</div>`, actionBar(primaryForCulto()));
    }

    const s = d.setlist;
    const head = s ? `
      <div class="page-head">
        <div class="grow"><p class="ds-eyebrow">Próximo culto</p>
          <h1 class="ds-h1" tabindex="-1">${esc(s.title)}</h1>
          <p class="lead muted">${esc(fmtDay(s.eventAt))} · ${esc(fmtTime(s.eventAt))}${s.publishedBy ? ` · publicado por ${esc(s.publishedBy)}` : ""}</p>
        </div>
        <button class="ds-button-secondary" data-act="prepare" ${S.loading ? "disabled" : ""} title="Ctrl+R">${icon("refresh")}${S.loading ? "Preparando…" : "Preparar de novo"}</button>
      </div>
      ${d.setlistChoices.length > 1 ? `<div class="field" style="max-width:26rem"><label for="setlist-pick">Setlist do dia</label><p class="help">${d.setlistChoices.length} setlists publicados para ${esc(fmtDay(s.eventAt).split(",")[0])}</p>
        <select id="setlist-pick" class="ds-input" data-change="pickSetlist">${d.setlistChoices.map((c) => `<option value="${esc(c.id)}" ${c.id === s.id ? "selected" : ""}>${esc(c.title)} — ${esc(fmtTime(c.eventAt))}</option>`).join("")}</select></div>` : ""}`
      : `<div class="page-head"><div><p class="ds-eyebrow">Próximo culto</p><h1 class="ds-h1" tabindex="-1">Culto de domingo</h1></div></div>`;

    const body = (!holyricsDown() && s) ? `
      <div class="culto-grid">
        <div class="dest-col">${renderDestination()}</div>
        <section class="ds-card" aria-labelledby="songs-h">${renderSongs()}</section>
      </div>` : "";

    return page(`${head}${banners}${body}`, actionBar(primaryForCulto()));
  }

  function techDetails(err) {
    if (!err || !err.technical) return "";
    return `<details class="sm" style="flex-basis:100%"><summary>Detalhes técnicos</summary>
      <div class="ds-card-muted mono" style="margin-top:.5rem">código: ${esc(err.code)}<br>versão do Holyrics: 2.30.0<br>${esc(err.technical.message)}</div>
      <button class="ds-button-ghost btn-sm" data-act="copyTech">${icon("copy")}Copiar detalhes</button></details>`;
  }

  function renderDestination() {
    const dest = S.data.destination;
    if (!dest) return "";
    const temp = dest.kind === "temporary";
    const typeLabel = temp ? "Playlist temporária" : dest.type === "event" ? "Evento da agenda" : "Culto da agenda";
    let check;
    if (temp) check = `${toneChip("neutral", "info", "Sem data para conferir")}<p class="sm muted" style="margin-top:.5rem">É a playlist aberta no Holyrics agora. Ela não tem data de culto, então o app não consegue conferir se é a certa: você confirma antes de substituir.</p>${helpLink("destino-playlist-temporaria")}`;
    else if (dest.check === "match") check = toneChip("ok", "check", "Mesmo dia do setlist");
    else if (dest.check === "dateMismatch") check = callout("warn", "alert", `O culto selecionado é de ${esc(fmtDate(dest.datetime).slice(0, 5))}, o setlist é de ${esc(fmtDate(S.data.setlist.eventAt).slice(0, 5))}`, "Confira se é o culto certo. Se não for, selecione o culto certo no Holyrics.", helpLink("destino-playlist-temporaria"));
    const count = dest.currentItems.length ? `${plural(dest.currentItems.length, "música", "músicas")} na playlist agora` : "playlist vazia agora";
    return `
      <section class="ds-card stack-sm dest-card" aria-labelledby="dest-h">
        <div><h2 class="ds-h2" id="dest-h">Destino no Holyrics</h2><p class="dest-name">${temp ? "Playlist temporária" : esc(dest.name)}</p>
          <p class="sm muted">${temp ? `Aparece como “${esc(dest.name)}” no Holyrics` : esc(typeLabel)}${!temp && dest.datetime ? ` · ${esc(fmtShort(dest.datetime))}` : ""} · ${count}</p></div>
        <div class="dest-check">${check}</div>
        ${!temp && dest.check === "match" ? `<p class="sm muted dest-help">O app só consegue mudar o que está <strong>selecionado</strong> no Holyrics. Para trocar, selecione o culto lá e clique em Verificar de novo.</p>` : ""}
        <button class="ds-button-secondary btn-sm dest-btn" data-act="recheckDest">${icon("refresh")}Verificar de novo</button>
      </section>`;
  }

  function renderSongs() {
    const items = S.data.items;
    const c = summary(items);
    const counted = c.total - c.repeated;
    const chips = Object.keys(STATE_META).filter((k) => c[k] > 0).map((k) => chip(k, `${c[k]} ${c[k] === 1 && k === "ready" ? "pronta" : STATE_META[k].many}`)).join("");
    if (!items.length) return `<h2 class="ds-h2" id="songs-h">Músicas do setlist</h2><p class="muted" style="margin-top:.5rem">Este setlist não tem músicas. Peça à liderança para conferir no Videira Music.</p>`;
    // Mais de 5 músicas com pendência: agrupa por estado (pendentes primeiro, prontas recolhidas).
    const pending = items.filter((i) => ["needsLink", "chooseVersion", "missing"].includes(i.state));
    const canGroup = items.length > 5 && pending.length > 0;
    const grouped = canGroup && S.songView !== "order";
    const toggle = canGroup ? `<div class="seg" role="group" aria-label="Organizar músicas">
        <button data-act="songView" data-arg="state" aria-pressed="${grouped}">Por estado</button>
        <button data-act="songView" data-arg="order" aria-pressed="${!grouped}">Na ordem do setlist</button></div>` : "";
    let list;
    if (grouped) {
      const repeated = items.filter((i) => i.state === "repeated");
      const ready = items.filter((i) => i.state === "ready");
      list = `
        <h3 class="group-h" id="g-pend">Precisam de você (${pending.length})</h3>
        <ol class="song-list" aria-labelledby="g-pend">${pending.map(renderSongRow).join("")}</ol>
        ${repeated.length ? `<h3 class="group-h" id="g-rep">Repetidas (${repeated.length})</h3><ol class="song-list" aria-labelledby="g-rep">${repeated.map(renderSongRow).join("")}</ol>` : ""}
        <details class="group-ready" ${S.readyOpen ? "open" : ""} data-toggle="readyOpen"><summary class="group-h">Prontas (${ready.length}) <span class="sm muted" style="font-weight:400;margin-left:.5rem;text-transform:none;letter-spacing:0">— ${S.readyOpen ? "recolher" : "mostrar"}</span></summary>
          <ol class="song-list">${ready.map(renderSongRow).join("")}</ol></details>`;
    } else {
      list = `<ol class="song-list">${items.map(renderSongRow).join("")}</ol>`;
    }
    const noLyrics = items.filter((i) => i.state === "ready" && i.lyricsPlaceholder).length;
    return `
      <div class="songs-sticky">
        <div class="row between" style="flex-wrap:wrap"><h2 class="ds-h2" id="songs-h">Músicas do setlist</h2>${toggle}</div>
        <div class="summary" style="margin-top:.5rem" aria-live="polite"><strong>${c.ready} de ${counted} ${counted === 1 ? "música pronta" : "músicas prontas"}</strong><span class="row-wrap">${chips}${noLyrics ? toneChip("warn", "alert", noLyrics === 1 ? "1 sem letra" : `${noLyrics} sem letra`) : ""}</span></div>
      </div>
      ${list}`;
  }

  function renderSongRow(it) {
    const meta = STATE_META[it.state];
    let support = esc(it.song.artist);
    let action = "";
    if (it.state === "needsLink") {
      support = it.staleLink ? "A música vinculada não existe mais nesta biblioteca. Achamos uma igual." : `Achamos “${esc(it.suggestion.title)}” de ${esc(it.suggestion.artist)} no Holyrics com o mesmo nome.`;
      action = `<button class="ds-button-secondary btn-sm" data-act="go" data-arg="review">Revisar</button>`;
    } else if (it.state === "chooseVersion") {
      support = it.approximate ? `Achamos “${esc(it.candidates[0].title)}”: nome parecido, mas não igual.` : `Há ${it.candidates.length} músicas com este nome no Holyrics.`;
      action = `<button class="ds-button-secondary btn-sm" data-act="openChoose" data-arg="${it.position}">${it.approximate ? "Conferir" : "Escolher"}</button>`;
    } else if (it.state === "missing") {
      support = "Precisa ser cadastrada no Holyrics antes.";
      action = `<button class="ds-button-secondary btn-sm" data-act="openMissing" data-arg="${it.position}">Como resolver</button>`;
    } else if (it.state === "ready" && it.lyricsPlaceholder) {
      support = `Letra ainda é ${PLACEHOLDER} no Holyrics: troque antes do culto.`;
    } else if (it.state === "repeated") {
      support = `Já está na posição ${it.repeatOf + 1}. O Holyrics não aceita a mesma música duas vezes na playlist.`;
    }
    return `<li class="song-row ${it.state === "repeated" ? "is-repeated" : ""}" aria-label="Posição ${it.position + 1}, ${esc(it.song.title)}, ${esc(it.song.artist)}, ${meta.label}">
      <span class="song-pos" aria-hidden="true">${it.position + 1}</span>
      <div><p class="song-title">${esc(it.song.title)}</p><p class="song-meta">${it.state === "ready" && !it.lyricsPlaceholder ? esc(it.song.artist) : `${esc(it.song.artist)} · ${support}`}</p></div>
      ${it.lyricsPlaceholder && it.state === "ready" ? toneChip("warn", "alert", "Pronta — sem letra") : it.approximate && it.state === "chooseVersion" ? chip(it.state, "Conferir parecida") : chip(it.state)}
      <span class="action-slot">${action}</span>
    </li>`;
  }

  // ---------------------------------------------------------------- T2 Revisar
  function renderReview() {
    const items = S.data.items;
    const batch = items.filter((i) => i.state === "needsLink");
    const individual = items.filter((i) => i.state === "chooseVersion");
    const missing = items.filter((i) => i.state === "missing");
    const selCount = batch.filter((i) => S.review.sel[i.songId] !== false).length;
    const nothing = !batch.length && !individual.length;

    const justLinked = S.flash && S.flash.kind === "linked";
    const batchHtml = batch.length ? `
      <section class="ds-card stack-sm" aria-labelledby="batch-h">
        <h2 class="ds-h2" id="batch-h">Mesmo nome e mesmo artista (${batch.length})</h2>
        <p class="sm muted">Só entram aqui músicas com uma única opção igual no Holyrics. Confira cada par e desmarque o que não for a mesma música.</p>
        <div class="row between batch-bar">
          <p aria-live="polite"><strong>${plural(selCount, "selecionado", "selecionados")}</strong> <span class="muted">de ${batch.length}</span></p>
          <div class="row-wrap"><button class="ds-button-ghost btn-sm" data-act="selAll" data-arg="1" ${selCount === batch.length || S.linking ? "disabled" : ""}>Marcar todos</button><button class="ds-button-ghost btn-sm" data-act="selAll" data-arg="0" ${selCount === 0 || S.linking ? "disabled" : ""}>Desmarcar todos</button></div>
        </div>
        <ul class="review-list">${batch.map((i) => {
          const on = S.review.sel[i.songId] !== false;
          return `<li class="review-item ${on ? "" : "is-off"}"><label class="check">
            <input type="checkbox" id="sel-${esc(i.songId)}" data-change="toggleSel" data-arg="${esc(i.songId)}" ${on ? "checked" : ""} ${S.linking ? "disabled" : ""}>
            <div class="pair grow">
              <div class="side"><small>Videira</small><strong>${esc(i.song.title)}</strong><div class="sm muted">${esc(i.song.artist)}</div></div>
              <span aria-hidden="true" class="muted">${icon("arrow")}</span>
              <div class="side"><small>Holyrics</small><strong>${esc(i.suggestion.title)}</strong><div class="sm muted">${esc(i.suggestion.artist)}</div></div>
            </div></label>
            ${i.staleLink ? `<p class="xs subtle" style="margin:.5rem 0 0 2rem">Vínculo antigo fica no histórico · <span class="mono">${esc(i.staleLink.oldId)} → ${esc(i.suggestion.id)}</span></p>` : ""}
          </li>`;
        }).join("")}</ul>
      </section>` : (!justLinked && (individual.length || missing.length)) ? `
      <section class="ds-card stack-sm" aria-labelledby="batch-h">
        <h2 class="ds-h2" id="batch-h">Nenhuma música para confirmar em lote</h2>
        <p class="sm muted">Só entram no lote músicas com nome e artista iguais e uma única opção no Holyrics. As músicas abaixo precisam de uma decisão por vez.</p>
      </section>` : "";

    const indHtml = individual.length ? `
      <section class="ds-card stack-sm" aria-labelledby="ind-h">
        <h2 class="ds-h2" id="ind-h">Decida uma por vez (${individual.length})</h2>
        <p class="sm muted">Mais de uma opção com o mesmo nome, ou nome só parecido. Estas nunca entram no lote.</p>
        <ol class="song-list">${individual.map(renderSongRow).join("")}</ol>
      </section>` : "";

    const missHtml = missing.length ? `
      <section class="ds-card stack-sm" aria-labelledby="miss-h">
        <h2 class="ds-h2" id="miss-h">Não estão no Holyrics</h2>
        <p class="sm muted">Cadastre no Holyrics e leia a biblioteca de novo. Se não der tempo, você pode publicar sem elas.</p>
        <ol class="song-list">${missing.map(renderSongRow).join("")}</ol>
      </section>` : "";

    const done = nothing ? callout("ok", "check", "Tudo revisado", missing.length ? `Só falta resolver ${plural(missing.length, "música que não está", "músicas que não estão")} no Holyrics, ou publicar sem ${missing.length === 1 ? "ela" : "elas"}.` : "Todas as músicas estão prontas para publicar.") : "";

    const p = batch.length
      ? { label: S.linking ? "Confirmando…" : `Confirmar ${plural(selCount, "vínculo", "vínculos")}`, act: "linkBatch", disabled: selCount === 0 || S.linking, hint: selCount === 0 ? "Marque ao menos uma música." : "O vínculo fica salvo no Videira Music. Dá para desfazer." }
      : { label: "Voltar ao culto", act: "go", arg: "culto", hint: "" };

    return page(`
      <div class="page-head"><div class="grow"><p class="ds-eyebrow">${esc(S.data.setlist.title)}</p><h1 class="ds-h1" tabindex="-1">Revisar músicas</h1>
        <p class="lead muted">Confirme uma vez; nas próximas semanas estas músicas já entram sozinhas.</p></div>
        <button class="ds-button-secondary" data-act="go" data-arg="culto">${icon("back")}Voltar ao culto</button></div>
      ${renderFlash()}${done}${batchHtml}${indHtml}${missHtml}`, actionBar(p));
  }

  // ---------------------------------------------------------------- diálogos
  function dialogShell(title, body, actions, wide = false) {
    return `<div class="overlay" data-act="overlay"><div class="dialog ${wide ? "wide" : ""}" role="dialog" aria-modal="true" aria-labelledby="dlg-title">
      <h2 class="dialog-title" id="dlg-title">${title}</h2>
      <div class="stack-sm" style="margin-top:1rem">${body}</div>
      <div class="dialog-actions">${actions}</div></div></div>`;
  }

  function renderDialog() {
    const g = S.dialog;
    const item = (pos) => S.data.items.find((i) => i.position === Number(pos));
    if (g.type === "choose") {
      const it = item(g.pos);
      const opts = it.candidates.map((c, idx) => `<label class="radio-card"><input type="radio" name="pick" value="${esc(c.id)}" data-change="pickCandidate" ${g.pick === c.id ? "checked" : ""} ${idx === 0 ? "data-autofocus" : ""}>
        <div><strong>${esc(c.title)}</strong> — ${esc(c.artist)}<div class="sm muted">Cadastrada no Holyrics em ${esc(fmtDate(c.createdAt))} · <span class="mono">${esc(c.id)}</span></div></div></label>`).join("");
      return dialogShell(it.approximate ? `“${esc(it.song.title)}” é esta música?` : `Qual “${esc(it.song.title)}” é a do setlist?`,
        `<p class="sm muted">No Videira: <strong>${esc(it.song.title)}</strong> — ${esc(it.song.artist)}. ${it.approximate ? "No Holyrics achamos uma com nome parecido, mas não igual. Confira antes de vincular:" : `No Holyrics há ${it.candidates.length} com este nome:`}</p>
         <fieldset style="border:0;padding:0;margin:0" class="stack-sm"><legend class="sr-only">Versões no Holyrics</legend>${opts}
         <label class="radio-card"><input type="radio" name="pick" value="none" data-change="pickCandidate" ${g.pick === "none" ? "checked" : ""}><div><strong>Nenhuma destas</strong><div class="sm muted">A música fica como “Não está no Holyrics”.</div></div></label></fieldset>
         <p class="sm">${helpLink("musica-ambigua-e-vinculos")}</p>`,
        `<span class="why">${g.pick ? "" : "Escolha uma opção."}</span><button class="ds-button-secondary" data-act="closeDialog">Cancelar</button><button class="ds-button" data-act="confirmChoose" ${g.pick ? "" : "disabled"}>${g.pick === "none" ? "Marcar como não encontrada" : it.approximate ? "Usar esta música" : "Usar esta versão"}</button>`);
    }
    if (g.type === "missing") return renderMissing(g, item(g.pos));
    if (g.type === "confirm") return renderConfirm(g);
    if (g.type === "restore") {
      const before = S.result.originalPlaylist.length, after = S.result.playlistNow.length;
      return dialogShell("Voltar a playlist ao que era antes?",
        `<p>As ${plural(after, "música do setlist sai", "músicas do setlist saem")} e as ${plural(before, "música de antes volta", "músicas de antes voltam")} para “${esc(S.result.destinationName)}”.</p>`,
        `<button class="ds-button-secondary" data-act="closeDialog" data-autofocus ${g.busy ? "disabled" : ""}>Cancelar</button><button class="ds-button-danger" data-act="doRestore" ${g.busy ? "disabled" : ""}>${g.busy ? "Restaurando…" : "Restaurar playlist"}</button>`);
    }
    if (g.type === "removeToken") {
      const name = g.service === "holyrics" ? "Holyrics" : "Videira Music";
      return dialogShell(`Remover o token do ${name} deste computador?`,
        `<p>O app para de funcionar até você colar um novo. ${g.service === "holyrics" ? "O token continua existindo no Holyrics; apague-o lá em Gerenciar permissões se não for mais usar." : "Para revogar de vez, peça a quem administra a igreja no Videira Music."}</p>`,
        `<button class="ds-button-secondary" data-act="closeDialog" data-autofocus>Cancelar</button><button class="ds-button-danger" data-act="doRemoveToken">Remover token</button>`);
    }
    return "";
  }

  // ---------------------------------------------------------------- T2b Não está no Holyrics → editor → reler → vincular
  // g.editor: null | "opening" | "requested" (pedido opaco) | "askConfirm" | "opened" | "notOpened" | "error"
  // g.reread: null | "reading" | "created" | "placeholder" | "notFound" | "ambiguous"  (= song.awaitCreated + checagem de letra)
  const PLACEHOLDER = "[Letra não fornecida]";
  const EDITOR_ERRORS = {
    EDITOR_ALREADY_OPEN: ["Já tem um editor de música aberto no Holyrics", "Salve ou feche essa janela no Holyrics e clique em Tentar de novo."],
    EDITOR_UNSUPPORTED: ["Esta versão do Holyrics não abre o editor por aqui", "Cadastre pelo próprio Holyrics (nova música) ou importe um arquivo; depois leia a biblioteca de novo."],
    RATE_LIMITED: ["O Holyrics pediu para esperar um pouco", "Espere 2 segundos e tente de novo."],
    HOLYRICS_UNREACHABLE: ["O Holyrics não respondeu", "Confira se o Holyrics está aberto e se Arquivo → Configurações → API Server → Ativar (local) está marcado."],
    EDITOR_FAILED: ["O Holyrics não abriu o editor", "Tente de novo. Se continuar, cadastre a música pelo próprio Holyrics."],
  };

  function renderMissing(g, it) {
    const t = esc(it.song.title), a = esc(it.song.artist);
    const cooling = Date.now() < (S.editorCooldownUntil || 0);
    const busyOpen = g.editor === "opening" || cooling;
    const openLabel = g.editor === "opening" ? "Abrindo…" : cooling ? "Aguarde…" : (g.editor ? "Abrir de novo no Holyrics" : "Abrir no Holyrics");
    let editorState = "";
    if (g.editor === "requested" || g.editor === "askConfirm") {
      editorState = callout("info", "external", "Pedimos ao Holyrics para abrir o editor — olhe a janela do Holyrics", `Deve aparecer “Nova música” com “${t}” e ${a} preenchidos.`,
        g.editor === "askConfirm" ? `<p style="flex-basis:100%;font-weight:700;margin:0">O editor abriu?</p><button class="ds-button-secondary btn-sm" data-act="editorConfirm" data-arg="yes" data-autofocus>Sim, abriu</button><button class="ds-button-secondary btn-sm" data-act="editorConfirm" data-arg="no">Não abriu</button>` : "", "status");
    } else if (g.editor === "opened") {
      editorState = callout("ok", "check", "O editor abriu no Holyrics", `${g.confirmedBy === "status" ? "O Holyrics confirmou. " : ""}Cole a letra, troque o texto ${PLACEHOLDER} e clique em Salvar lá. Depois volte aqui.`, "", "status");
    } else if (g.editor === "notOpened") {
      editorState = callout("warn", "alert", "O editor não abriu", "", `<ul style="flex-basis:100%;list-style:disc;padding-left:1.25rem;font-size:.875rem">
          <li><strong>Holyrics fechado?</strong> Abra o Holyrics neste computador.</li>
          <li><strong>API desligada?</strong> Arquivo → Configurações → API Server → marque Ativar (local).</li>
          <li><strong>Já tem um editor de música aberto?</strong> Salve ou feche essa janela no Holyrics.</li></ul>
        ${helpLink("musica-nao-esta-no-holyrics")}
        <button class="ds-button-secondary btn-sm" data-act="openEditor">${icon("refresh")}Tentar de novo</button>`, "alert");
    } else if (g.editor === "error") {
      const [title, body] = EDITOR_ERRORS[g.errorCode] || EDITOR_ERRORS.EDITOR_FAILED;
      editorState = callout(g.errorCode === "RATE_LIMITED" ? "info" : "warn", "alert", title, body, `<button class="ds-button-secondary btn-sm" data-act="openEditor">${icon("refresh")}Tentar de novo</button>${helpLink(HELP_FOR_CODE[g.errorCode] || "musica-nao-esta-no-holyrics")}`, "alert");
    }

    const placeholderWarn = callout("warn", "alert", `No Holyrics, troque o texto ${PLACEHOLDER} pela letra antes de salvar`, "O app não tem a letra desta música, então o editor abre com essa frase no lugar dela. Se salvar assim, ela aparece no telão.");

    let result = "";
    const expected = `<div class="ds-card-muted mono" style="color:inherit;margin-top:.5rem">Título: ${t}<br>Artista: ${a}</div>`;
    if (g.reread === "reading") result = `<p class="sm" role="status">Lendo a biblioteca do Holyrics…</p>`;
    else if (g.reread === "created" || g.reread === "placeholder") {
      const f = g.found;
      result = `${g.reread === "created"
          ? callout("ok", "check", "Encontramos a música nova no Holyrics", "Confira e confirme o vínculo. Ele fica salvo no Videira Music.", "", "status")
          : callout("warn", "alert", `“${t}” foi salva, mas a letra ainda é ${PLACEHOLDER}`, "Se publicar assim, essa frase aparece no telão. No Holyrics, procure a música na biblioteca, abra para editar, troque o texto pela letra e salve. Depois clique em Ler de novo.",
              `<details class="sm" style="flex-basis:100%"><summary>Por que o app não abre essa música para editar?</summary><p style="margin-top:.25rem">Por aqui o Holyrics só abre o editor de <strong>música nova</strong>. Abrir de novo criaria uma segunda cópia, e aí ficariam duas “${t}” na biblioteca.</p></details>`, "alert")}
        <div class="review-item"><div class="pair">
          <div class="side"><small>Videira</small><strong>${t}</strong><div class="sm muted">${a}</div></div>
          <span aria-hidden="true" class="muted">${icon("arrow")}</span>
          <div class="side"><small>Holyrics · nova</small><strong>${esc(f.title)}</strong><div class="sm muted">${esc(f.artist)}</div>${g.reread === "placeholder" ? `<div class="xs" style="color:hsl(var(--color-warning));margin-top:.25rem">Letra: ${PLACEHOLDER}</div>` : ""}</div>
        </div></div>`;
    } else if (g.reread === "notFound") {
      result = callout("warn", "alert", `Ainda não encontramos uma música nova chamada “${t}”`, "Confira se clicou em Salvar no Holyrics e se o título e o artista estão exatamente assim (acentos e maiúsculas não importam; pontuação importa):", expected, "status");
    } else if (g.reread === "ambiguous") {
      result = `${callout("warn", "diamond", `Encontramos ${g.candidates.length} músicas novas chamadas “${t}”`, "Talvez tenha sido salva duas vezes. Escolha qual vincular; a outra pode ser apagada depois no Holyrics.", "", "status")}
        <fieldset style="border:0;padding:0;margin:0" class="stack-sm"><legend class="sr-only">Músicas novas no Holyrics</legend>${g.candidates.map((c, idx) => `<label class="radio-card"><input type="radio" name="newpick" value="${esc(c.id)}" data-change="pickNew" ${g.pick === c.id ? "checked" : ""} ${idx === 0 ? "data-autofocus" : ""}>
          <div><strong>${esc(c.title)}</strong> — ${esc(c.artist)}<div class="sm muted">Salva hoje às ${esc(c.savedAt)} · <span class="mono">${esc(c.id)}</span></div></div></label>`).join("")}</fieldset>`;
    }

    const results = g.search != null ? `<div class="field"><label for="lib-search">Procurar na biblioteca do Holyrics</label><input id="lib-search" class="ds-input" data-input="libSearch" value="${esc(g.search)}" placeholder="Nome ou artista"></div>
        <ul class="list-rows">${librarySearch(g.search).map((s) => `<li><div class="grow"><strong>${esc(s.title)}</strong><div class="sm muted">${esc(s.artist)}</div></div><button class="ds-button-secondary btn-sm" data-act="linkManual" data-arg="${esc(s.id)}">Usar esta</button></li>`).join("") || `<li class="muted sm">Nenhuma música parecida.</li>`}</ul>` : "";

    const modeNote = S.holyricsReal ? `<p class="xs subtle" style="font-weight:400">Protótipo em modo Holyrics real: o botão chama ${esc(S.holyricsUrl)}/api/popup-createsong. A releitura da biblioteca continua simulada.</p>` : "";

    let primary;
    if (g.reread === "created") primary = `<button class="ds-button" data-act="confirmCreated" data-autofocus>Confirmar vínculo</button>`;
    else if (g.reread === "ambiguous") primary = `<button class="ds-button" data-act="confirmCreated" ${g.pick ? "" : "disabled"}>Usar esta versão</button>`;
    else primary = `<button class="ds-button" data-act="reread" ${g.editor ? "data-autofocus" : ""} ${g.reread === "reading" ? "disabled" : ""}>${g.reread === "reading" ? "Lendo…" : g.reread ? "Ler de novo" : "Ler a biblioteca de novo"}</button>`;
    const secondary = g.reread === "placeholder" ? `<button class="ds-button-secondary" data-act="confirmCreated">Vincular mesmo assim</button>` : "";
    const why = g.reread === "ambiguous" && !g.pick ? "Escolha uma das músicas." : g.reread === "placeholder" ? "A letra continua faltando se vincular agora." : "";

    return dialogShell(`“${t}” não está no Holyrics`, `
      <p class="sm muted">O app não cria músicas sozinho: ele abre o editor do Holyrics já com o nome, e você salva lá. ${helpLink("musica-nao-esta-no-holyrics")}</p>
      <ol class="instructions">
        <li><div class="grow stack-sm"><div><strong>Abrir o editor do Holyrics já com o nome</strong></div>
          <div><button class="ds-button-secondary btn-sm" data-act="openEditor" ${g.editor ? "" : "data-autofocus"} ${busyOpen ? "disabled" : ""}>${icon("external")}${openLabel}</button></div>
          ${editorState}${modeNote}</div></li>
        <li><div class="grow stack-sm"><div><strong>No Holyrics: cole a letra e clique em Salvar</strong></div>${placeholderWarn}</div></li>
        <li><div><strong>Volte aqui e leia a biblioteca de novo</strong> — vamos procurar “${t}” de ${a} entre as músicas novas.</div></li>
      </ol>
      ${result}
      <details class="sm"><summary>Outros caminhos</summary><div class="stack-sm" style="margin-top:.25rem">
        <p><strong>Importar um arquivo</strong> (TXT, OpenLP ou OpenSong) se você tem a letra: no Holyrics, Arquivo → Importar.</p>
        <p><strong>Já está no Holyrics com outro nome?</strong> <button class="ds-link" data-act="openSearch">Procurar na biblioteca</button></p>
        ${results}</div></details>`,
      `<span class="why">${why}</span><button class="ds-button-secondary" data-act="closeDialog">Fechar</button>${secondary}${primary}`, true);
  }

  // Modo demo real (?holyrics=real, servido por http). No app final isto vai pelo processo principal (song.openEditor).
  async function requestHolyricsEditor(song) {
    const url = new URL(S.holyricsUrl);
    if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) return { kind: "error", code: "EDITOR_FAILED" };
    const endpoint = `${url.origin}/api/popup-createsong`;
    const body = JSON.stringify({ title: song.title, artist: song.artist, lyrics: PLACEHOLDER });
    try {
      // 1º: CORS normal. O Holyrics responde Access-Control-Allow-Origin: * e exige Content-Type EXATAMENTE application/json (senão 415).
      const r = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body, signal: AbortSignal.timeout(5000) });
      const map = { 400: "EDITOR_FAILED", 403: "EDITOR_FAILED", 404: "EDITOR_UNSUPPORTED", 409: "EDITOR_ALREADY_OPEN", 415: "EDITOR_FAILED", 429: "RATE_LIMITED" };
      return r.ok ? { kind: "opened" } : { kind: "error", code: map[r.status] || "EDITOR_FAILED", status: r.status };
    } catch {
      try {
        // 2º: reserva opaca (no-cors só permite text/plain; o status não é legível e pode ter sido 415).
        await fetch(endpoint, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain" }, body, signal: AbortSignal.timeout(5000) });
        return { kind: "opaque" };
      } catch {
        return { kind: "error", code: "HOLYRICS_UNREACHABLE" };
      }
    }
  }

  function librarySearch(q) {
    const lib = [...D.PLAYLIST_BEFORE, { id: "1792693855267", title: "Mil Graus", artist: "Renascer Praise" }, { id: "1793000000009", title: "Deus de Promessas (Ao Vivo)", artist: "Davi Sacer" }, { id: "1792693855260", title: "E Ele", artist: "DROPS" }];
    const n = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    if (!q) return lib.slice(0, 4);
    return lib.filter((s) => n(s.title + " " + s.artist).includes(n(q))).slice(0, 6);
  }

  function renderConfirm(g) {
    const d = S.data;
    const before = d.destination.currentItems;
    const after = targetItems();
    const out = leftOut();
    const repeated = d.items.filter((i) => i.state === "repeated");
    const needPartial = out.length > 0, needDest = destSuspect();
    const blocked = (needPartial && !g.ackPartial) || (needDest && !g.ackDest);
    const temp = isTemp();
    const why = needPartial && !g.ackPartial ? "Marque para publicar sem essas músicas." : needDest && !g.ackDest ? (temp ? "Marque “Estou no culto certo” para continuar." : "Confirme o destino para continuar.") : "";
    // Colunas sem rolagem escondida: até 10 itens aparecem inteiros; acima disso, 8 + botão "Mostrar mais N".
    const col = (key, rows, renderRow) => {
      const limit = rows.length > 10 && !g[key] ? 8 : rows.length;
      const hidden = rows.length - limit;
      return `<ol id="col-${key}">${rows.slice(0, limit).map(renderRow).join("")}</ol>
        ${rows.length > 10 ? `<button class="diff-more" data-act="toggleCol" data-arg="${key}" aria-expanded="${!!g[key]}" aria-controls="col-${key}">${g[key] ? "Mostrar menos" : `+ ${plural(hidden, "música", "músicas")} — mostrar todas`}</button>` : ""}`;
    };
    const risk = before.length
      ? callout("warn", "alert", `As ${plural(before.length, "música de hoje sai", "músicas de hoje saem")} da playlist`, "Elas continuam na biblioteca do Holyrics; só saem desta playlist. Guardamos uma cópia para voltar se der errado.")
      : callout("info", "info", "A playlist está vazia agora", `Nada vai sair. ${after.length === 1 ? "A música do setlist entra" : `As ${after.length} músicas do setlist entram`} nela.`);
    return dialogShell(temp ? "Substituir a playlist temporária do Holyrics?" : `Substituir a playlist de “${esc(d.destination.name)}”?`, `
      ${risk}
      <div class="diff-columns">
        <div class="diff-col before"><h3>Hoje no Holyrics (${before.length})</h3>${before.length
          ? col("allBefore", before, (s, i) => `<li><span class="n">${i + 1}</span><span class="t">${esc(s.title)}</span><span class="tag">sai</span></li>`)
          : `<p class="diff-empty">Vazia — nenhuma música vai sair.</p>`}</div>
        <div class="diff-col"><h3>Vai ficar (${after.length})</h3>${col("allAfter", after, (s, i) => `<li><span class="n">${i + 1}</span><span><strong>${esc(s.song.title)}</strong><br><span class="xs subtle" style="font-weight:400">${esc(s.song.artist)}</span></span></li>`)}</div>
      </div>
      ${repeated.length ? `<p class="sm muted">${icon("repeat")} ${repeated.map((r) => `“${esc(r.song.title)}”`).join(", ")} aparece 1 vez (estava repetida no setlist).</p>` : ""}
      ${after.filter((i) => i.lyricsPlaceholder).map((i) => callout("warn", "alert", `“${esc(i.song.title)}” ainda está sem letra no Holyrics`, `O texto ${PLACEHOLDER} vai aparecer no telão. Troque pela letra no Holyrics antes do culto.`)).join("")}
      ${d.setlistSource === "cache" ? `<p class="sm muted">${icon("info")} Sem internet: usando o setlist baixado ${esc(fmtShort(d.setlistCachedAt))}. O aviso ao Videira será enviado depois.</p>` : ""}
      ${needPartial ? `<label class="check ds-card-muted" style="color:inherit"><input type="checkbox" data-change="ackPartial" ${g.ackPartial ? "checked" : ""}><span>Publicar mesmo sem: <strong>${out.map((o) => esc(o.song.title)).join(", ")}</strong><br><span class="sm muted">${out.length === 1 ? "Ela fica" : "Elas ficam"} fora da playlist até você resolver.</span></span></label>` : ""}
      ${needDest ? `<label class="check ds-card-muted" style="color:inherit"><input type="checkbox" data-change="ackDest" ${g.ackDest ? "checked" : ""}>${temp
        ? `<span><strong>Estou no culto certo</strong><br><span class="sm muted">A playlist temporária não tem data, então o app não consegue conferir. Olhe no Holyrics se é a playlist que vai para o telão agora.</span></span>`
        : `<span>Confirmo que <strong>${esc(d.destination.name)}</strong> é o destino certo<br><span class="sm muted">A data do culto selecionado é diferente da data do setlist.</span></span>`}</label>
        <p class="sm">${helpLink("destino-playlist-temporaria")}</p>` : ""}`,
      `<span class="why">${why}</span><button class="ds-button-secondary" data-act="closeDialog" data-autofocus>Cancelar</button><button class="ds-button-danger" data-act="apply" ${blocked ? "disabled" : ""}>${icon("alert")}Substituir playlist</button>`, true);
  }

  // ---------------------------------------------------------------- T4 Publicando
  function renderProgress() {
    const p = S.progress;
    const ico = (st) => st === "done" ? icon("check") : st === "failed" ? icon("x") : "";
    return page(`
      <div><p class="ds-eyebrow">${esc(S.data.destination.name)}</p><h1 class="ds-h1" tabindex="-1">Publicando no Holyrics…</h1>
      <p class="lead muted">Não feche o Holyrics agora. Leva uns 5 segundos.</p></div>
      <section class="ds-card"><ol class="step-list" aria-label="Etapas">${p.steps.map((s, i) => `
        <li class="${s.status}" ${s.status === "running" ? 'aria-current="step"' : ""}><span class="step-ico" aria-hidden="true">${ico(s.status)}</span>
        <span class="grow">${esc(s.label)}${s.note ? `<br><span class="sm muted" style="font-weight:400">${esc(s.note)}</span>` : ""}</span>
        <span class="sr-only">Etapa ${i + 1} de ${p.steps.length}: ${{ pending: "aguardando", running: "em andamento", done: "feita", failed: "falhou" }[s.status]}</span></li>`).join("")}</ol></section>`,
      `<div class="action-bar"><span class="hint">Publicação em andamento — não dá para cancelar no meio, para não deixar a playlist pela metade.</span></div>`);
  }

  async function runApply() {
    const d = S.data;
    const outcome = d.applyOutcome;
    const after = targetItems();
    const offline = d.connections.videira.status !== "ok";
    S.dialog = null;
    S.screen = "progress";
    S.progress = { steps: [
      { key: "backup", label: "Guardando uma cópia da playlist atual", status: "pending" },
      { key: "remove", label: "Tirando as músicas antigas", status: "pending" },
      { key: "add", label: `Colocando as ${plural(after.length, "música", "músicas")} na ordem`, status: "pending" },
      { key: "verify", label: "Conferindo no Holyrics", status: "pending" },
      { key: "report", label: "Avisando o Videira Music", status: "pending" },
    ] };
    render();
    const step = async (key, status = "done", note, wait = 650) => {
      const s = S.progress.steps.find((x) => x.key === key);
      s.status = "running"; render(); announce(s.label);
      await sleep(wait);
      s.status = status; if (note) s.note = note; render();
    };
    await step("backup");
    await step("remove");
    if (outcome === "verified") {
      await step("add");
      await step("verify", "done", null, 900);
    } else {
      const add = S.progress.steps.find((x) => x.key === "add");
      add.status = "running"; add.note = "O Holyrics está demorando para responder…"; render();
      await sleep(1300);
      add.status = "failed"; add.note = "O Holyrics parou de responder."; render();
      S.progress.steps.splice(3, 1, { key: "restore", label: "Voltando a playlist ao que era", status: "pending" });
      await step("restore", outcome === "failedRestored" ? "done" : "failed", outcome === "failedRestored" ? "Conferido: a playlist de antes está de volta." : "Não conseguimos voltar a playlist.", 1000);
    }
    await step("report", "done", offline ? "Sem internet: o aviso fica guardado e é enviado depois." : null);

    const before = d.destination.currentItems;
    const ok = outcome === "verified";
    const out = leftOut();
    S.result = {
      outcome: ok ? (out.length ? "partial" : "verified") : outcome,
      verifiedAt: nowIso(),
      destinationName: d.destination.name,
      playlistNow: ok ? after.map((i) => ({ id: i.holyrics.id, title: i.song.title, artist: i.song.artist })) : outcome === "failedRestored" ? before : after.slice(0, 1).map((i) => ({ id: i.holyrics.id, title: i.song.title, artist: i.song.artist })),
      originalPlaylist: before,
      leftOut: out,
      repeated: d.items.filter((i) => i.state === "repeated"),
      report: { status: offline ? "queued" : "sent" },
      canRestore: ok,
      error: ok ? null : { code: outcome === "failedRestored" ? "APPLY_FAILED" : "RESTORE_FAILED", technical: { message: "AddLyricsToPlaylist: timeout após 10000 ms (127.0.0.1:8091)" } },
    };
    if (offline) d.pendingReports.push({ id: "q-" + Date.now(), setlistTitle: d.setlist.title, createdAt: nowIso(), attempts: 1, lastError: "VIDEIRA_OFFLINE" });
    S.sessionRuns.unshift({ id: "s-" + Date.now(), at: nowIso(), setlistTitle: d.setlist.title, destinationName: d.destination.name, outcome: S.result.outcome, songCount: after.length, reportStatus: S.result.report.status });
    if (ok) {
      d.destination = { ...d.destination, currentItems: S.result.playlistNow };
      d.alreadyApplied = true;
    } else {
      d.applyOutcome = "verified"; // a próxima tentativa do protótipo dá certo
    }
    S.screen = "result";
    render();
    announce({ verified: "Publicado e conferido.", partial: "Publicado com músicas de fora.", failedRestored: "Não deu certo. A playlist voltou ao que era.", failedNotRestored: "Não deu certo e a playlist ficou incompleta." }[S.result.outcome]);
  }

  // ---------------------------------------------------------------- T5 Resultado
  function renderResult() {
    const r = S.result;
    const time = fmtTime(r.verifiedAt);
    const list = (arr, ok) => `<ol class="song-list">${arr.map((s, i) => `<li class="song-row" style="grid-template-columns:2.25rem 1fr auto"><span class="song-pos" aria-hidden="true">${i + 1}</span><div><p class="song-title">${esc(s.title)}</p><p class="song-meta">${esc(s.artist || "")}</p></div>${ok ? toneChip("ok", "check", "Conferida") : ""}</li>`).join("")}</ol>`;
    let head, body, p, secondary = "";
    const reportLine = r.report.status === "queued" ? `<p class="sm muted">${icon("info")} O Videira Music será avisado quando a internet voltar.</p>` : `<p class="sm muted">${icon("send")} Videira Music avisado.</p>`;
    if (r.outcome === "verified" || r.outcome === "partial") {
      const partial = r.outcome === "partial";
      head = partial ? `Publicado sem ${plural(r.leftOut.length, "música", "músicas")}` : "Publicado e conferido";
      body = `${callout(partial ? "warn" : "ok", partial ? "alert" : "check", partial ? `Ficou de fora: ${r.leftOut.map((o) => `“${esc(o.song.title)}”`).join(", ")}` : `A playlist de “${esc(r.destinationName)}” tem as ${plural(r.playlistNow.length, "música", "músicas")} na ordem do setlist`, partial ? `As outras ${plural(r.playlistNow.length, "música está", "músicas estão")} na ordem e foram conferidas no Holyrics às ${esc(time)}.` : `Conferido no Holyrics às ${esc(time)}.`, "", "status")}
        ${r.repeated.length ? `<p class="sm muted">${icon("repeat")} ${r.repeated.map((x) => `“${esc(x.song.title)}”`).join(", ")} aparece 1 vez (estava repetida no setlist).</p>` : ""}
        <section class="ds-card"><h2 class="ds-h2">Playlist no Holyrics agora</h2>${list(r.playlistNow, true)}</section>${reportLine}
        ${S.restoreMsg ? callout("ok", "check", esc(S.restoreMsg), "", "", "status") : ""}`;
      p = { label: "Pronto", act: "finish", hint: r.canRestore ? "Se algo não estiver certo, você pode voltar a playlist ao que era." : "" };
      if (partial) secondary += `<button class="ds-button-secondary" data-act="go" data-arg="review">Resolver pendências</button>`;
      if (r.canRestore) secondary += `<button class="ds-button-secondary" data-act="openRestore">${icon("undo")}Restaurar playlist anterior</button>`;
    } else if (r.outcome === "failedRestored") {
      head = "Não deu certo — a playlist voltou ao que era";
      body = `${callout("danger", "x", "O Holyrics parou de responder enquanto colocávamos as músicas", `Conferimos: as ${plural(r.originalPlaylist.length, "música", "músicas")} de antes estão de volta em “${esc(r.destinationName)}”. Confira se o Holyrics está aberto e tente de novo.`, techDetails(r.error), "alert")}
        <section class="ds-card"><h2 class="ds-h2">Playlist no Holyrics agora (igual a antes)</h2>${list(r.originalPlaylist, true)}</section>${reportLine}`;
      p = { label: "Tentar de novo", act: "openConfirm", hint: "" };
      secondary = `<button class="ds-button-secondary" data-act="finish">Voltar ao culto</button>`;
    } else {
      head = "Não deu certo e a playlist ficou incompleta";
      body = `${callout("danger", "x", `Não conseguimos voltar a playlist de “${esc(r.destinationName)}”`, "Tente publicar de novo. Se não der, refaça no Holyrics com a lista abaixo — era assim antes:", techDetails(r.error), "alert")}
        <section class="ds-card"><div class="row between"><h2 class="ds-h2">Playlist de antes</h2><button class="ds-button-secondary btn-sm" data-act="copyList">${icon("copy")}Copiar lista</button></div>${list(r.originalPlaylist, false)}</section>
        ${S.flash ? renderFlash() : ""}${reportLine}`;
      p = { label: "Tentar de novo", act: "openConfirm", hint: "" };
      secondary = `<button class="ds-button-secondary" data-act="finish">Voltar ao culto</button>`;
    }
    return page(`<div><p class="ds-eyebrow">${esc(S.data.setlist.title)}</p><h1 class="ds-h1" tabindex="-1">${head}</h1></div>${body}`, actionBar(p, secondary));
  }

  // ---------------------------------------------------------------- T6 Vínculos / reconciliação
  function renderVinculos() {
    const d = S.data;
    if (d.reconciliation.active && !S.recon.done) {
      const R = D.reconciliation;
      const sel = R.batch.filter((b) => S.recon.sel[b.songId] !== false).length;
      const sorted = [...R.batch].sort((a, b) => Number(b.inCurrentSetlist) - Number(a.inCurrentSetlist));
      const indiv = R.individual.map((r) => `<li class="review-item"><p><strong>${esc(r.videira.title)}</strong> — ${esc(r.videira.artist)}</p>
        <fieldset style="border:0;padding:0;margin:.5rem 0 0" class="stack-sm"><legend class="sm muted">Há ${r.candidates.length} com este nome na nova biblioteca:</legend>
        ${r.candidates.map((c) => `<label class="radio-card"><input type="radio" name="recon-${esc(r.songId)}" value="${esc(c.id)}" data-change="reconPick" data-arg="${esc(r.songId)}" ${S.recon.picks[r.songId] === c.id ? "checked" : ""}><div>${esc(c.title)} — ${esc(c.artist)}<div class="sm muted">Importada em ${esc(fmtDate(c.createdAt))} · <span class="mono">${esc(c.id)}</span></div></div></label>`).join("")}
        <label class="radio-card"><input type="radio" name="recon-${esc(r.songId)}" value="later" data-change="reconPick" data-arg="${esc(r.songId)}" ${S.recon.picks[r.songId] === "later" ? "checked" : ""}><div>Decidir depois</div></label></fieldset></li>`).join("");
      return page(`
        <div class="page-head"><div class="grow"><p class="ds-eyebrow">Biblioteca do Holyrics mudou</p><h1 class="ds-h1" tabindex="-1">Atualizar vínculos</h1>
          <p class="lead muted">Antes: ${R.previousLibrary.songCount} músicas em <span class="mono">${esc(R.previousLibrary.baseDir)}</span>. Agora: ${R.currentLibrary.songCount} em <span class="mono">${esc(R.currentLibrary.baseDir)}</span>. Os vínculos antigos ficam guardados no histórico; nada é apagado.</p></div></div>
        <div class="row-wrap">${toneChip("ok", "check", `${R.summary.unchanged} continuam iguais`)}${toneChip("info", "link", `${R.summary.exactPair} acharam par igual`)}${toneChip("warn", "diamond", `${R.summary.multiple} com mais de uma opção`)}${toneChip("danger", "x", `${R.summary.noPair} sem par`)}</div>
        <section class="ds-card stack-sm" aria-labelledby="rb-h"><h2 class="ds-h2" id="rb-h">${R.batch.length} músicas com par igual na nova biblioteca</h2>
          <p class="sm muted">Mesmo nome e mesmo artista. Desmarque as que não forem a mesma música.</p>
          <ul class="review-list">${sorted.map((b) => { const on = S.recon.sel[b.songId] !== false; return `<li class="review-item ${on ? "" : "is-off"}"><label class="check">
            <input type="checkbox" id="rsel-${esc(b.songId)}" data-change="reconSel" data-arg="${esc(b.songId)}" ${on ? "checked" : ""}>
            <div class="grow"><div class="row-wrap"><strong>${esc(b.videira.title)}</strong><span class="sm muted">${esc(b.videira.artist)}</span>${b.inCurrentSetlist ? `<span class="ds-badge">No culto de domingo</span>` : ""}</div>
            <div class="mono subtle" aria-label="ID antigo terminando em ${esc(b.oldId.slice(-3))}, novo terminando em ${esc(b.new.id.slice(-3))}">${esc(b.oldId)} → ${esc(b.new.id)}</div></div></label></li>`; }).join("")}</ul></section>
        <section class="ds-card stack-sm" aria-labelledby="ri-h"><h2 class="ds-h2" id="ri-h">Escolha uma por vez</h2><ul class="review-list">${indiv}</ul></section>
        <section class="ds-card stack-sm" aria-labelledby="rn-h"><h2 class="ds-h2" id="rn-h">${R.noPair.length} sem par na nova biblioteca</h2>
          <p class="sm muted">Ficam como vínculo antigo. Quando a música aparecer no Holyrics, sugerimos de novo.</p>
          <ul class="list-rows">${R.noPair.map((n) => `<li><div class="grow"><strong>${esc(n.videira.title)}</strong><div class="sm muted">${esc(n.videira.artist)}</div></div>${chip("missing")}</li>`).join("")}</ul></section>`,
        actionBar({ label: `Confirmar ${plural(sel, "troca", "trocas")}`, act: "confirmRecon", disabled: sel === 0, hint: sel === 0 ? "Marque ao menos uma troca." : "As músicas com uma opção marcada também entram." }, `<button class="ds-button-secondary" data-act="go" data-arg="culto">Revisar depois</button>`));
    }
    const links = [...S.sessionLinks, ...D.links];
    return page(`
      <div class="page-head"><div><p class="ds-eyebrow">Videira Music ↔ Holyrics</p><h1 class="ds-h1" tabindex="-1">Vínculos</h1>
      <p class="lead muted">Cada música do Videira aponta para uma música da biblioteca do Holyrics. O vínculo fica salvo no Videira Music.</p></div></div>
      ${renderFlash()}
      ${S.recon.done ? callout("ok", "check", "Biblioteca reconciliada", "Os vínculos antigos ficaram no histórico.") : callout("ok", "check", "Nenhuma mudança na biblioteca do Holyrics", "Se o Holyrics for reinstalado ou as músicas forem importadas de novo, avisamos aqui.")}
      <section class="ds-card"><h2 class="ds-h2">${links.length} músicas vinculadas</h2>
      <ul class="list-rows" style="margin-top:.5rem">${links.map((l) => `<li><div class="grow"><strong>${esc(l.title)}</strong><div class="sm muted">${esc(l.artist)} · desde ${esc(fmtDate(l.since))} · ${l.source === "batch" ? "confirmada em lote" : l.source === "reconciliation" ? "reconciliação" : "escolhida individualmente"}</div></div><span class="mono subtle">${esc(l.holyricsId)}</span></li>`).join("")}</ul></section>`, "");
  }

  // ---------------------------------------------------------------- T7 Histórico
  function renderHistorico() {
    const d = S.data;
    const runs = [...S.sessionRuns, ...D.history];
    const outcomeChip = (o) => ({ verified: toneChip("ok", "check", "Publicado e conferido"), partial: toneChip("warn", "alert", "Publicado com músicas de fora"), failedRestored: toneChip("danger", "x", "Falhou — playlist restaurada"), failedNotRestored: toneChip("danger", "x", "Falhou — playlist incompleta") }[o]);
    const pend = d.pendingReports;
    return page(`
      <div class="page-head"><div><h1 class="ds-h1" tabindex="-1">Histórico</h1><p class="lead muted">O que foi publicado neste computador e o que o Videira Music já sabe.</p></div></div>
      ${S.reportMsg ? callout(S.reportMsg.tone, S.reportMsg.tone === "ok" ? "check" : "alert", esc(S.reportMsg.title), esc(S.reportMsg.body || ""), "", "status") : ""}
      ${pend.length ? callout("info", "send", `${plural(pend.length, "aviso ao Videira ainda não foi enviado", "avisos ao Videira ainda não foram enviados")}`, `Ficam guardados neste computador até a internet voltar. ${pend.map((p) => `${esc(p.setlistTitle)} (${esc(fmtShort(p.createdAt))})`).join("; ")}.`, `<button class="ds-button btn-sm" data-act="sendReports" ${S.sending ? "disabled" : ""}>${S.sending ? "Enviando…" : "Enviar agora"}</button>`) : ""}
      <section class="ds-card"><h2 class="ds-h2">Publicações</h2>
      ${runs.length ? `<ul class="list-rows" style="margin-top:.5rem">${runs.map((r) => `<li><div class="grow"><strong>${esc(r.setlistTitle)}</strong> <span class="muted">→ ${esc(r.destinationName)}</span>
        <div class="sm muted">${esc(fmtShort(r.at))} · ${plural(r.songCount, "música", "músicas")}${r.note ? ` · ${esc(r.note)}` : ""} · ${r.reportStatus === "queued" ? "aviso na fila" : "Videira avisado"}</div></div>${outcomeChip(r.outcome)}</li>`).join("")}</ul>`
        : `<p class="muted">Nenhuma publicação ainda. Depois de publicar um culto, ele aparece aqui.</p>`}</section>`, "");
  }

  // ---------------------------------------------------------------- T8 Ajustes
  function renderAjustes() {
    const d = S.data;
    const h = d.connections.holyrics, v = d.connections.videira;
    const seg = (name, value, opts) => `<div class="seg" role="group" aria-label="${name}">${opts.map(([val, label]) => `<button data-act="set-${name}" data-arg="${val}" aria-pressed="${String(value) === String(val)}">${label}</button>`).join("")}</div>`;
    const hState = h.status === "ok" ? toneChip("ok", "check", `Conectado · Holyrics ${h.detail.version}`) : toneChip("danger", "x", { unreachable: "Não está respondendo", tokenInvalid: "Token recusado", permissionMissing: "Falta permissão", notConfigured: "Sem token" }[h.status] || h.status);
    const vState = v.status === "ok" ? toneChip("ok", "check", `Conectado · ${v.detail.organizationName}`) : v.status === "offline" ? toneChip("warn", "alert", "Sem internet") : toneChip("danger", "x", { tokenInvalid: "Token recusado", notConfigured: "Sem token" }[v.status] || v.status);
    return page(`
      <div><h1 class="ds-h1" tabindex="-1">Ajustes</h1></div>
      ${S.settingsMsg ? callout("ok", "check", esc(S.settingsMsg), "", "", "status") : ""}
      <section class="ds-card stack-sm settings-section" aria-labelledby="s-h"><div class="row between"><h2 class="ds-h2" id="s-h">Holyrics</h2>${hState}</div>
        <dl class="kv"><dt>Endereço</dt><dd class="mono">127.0.0.1:${h.detail.port || 8091}</dd><dt>Token</dt><dd class="mono">${h.status === "notConfigured" ? "—" : "••••••••••••a1B9"}</dd><dt>Holyrics Plan</dt><dd>Não tem (normal) — o app muda só o culto selecionado no Holyrics</dd></dl>
        <div class="row-wrap"><button class="ds-button-secondary btn-sm" data-act="testConn" data-arg="holyrics">Testar</button><button class="ds-button-secondary btn-sm" data-act="swapToken" data-arg="holyrics">Trocar token</button><button class="ds-button-ghost btn-sm" data-act="openRemoveToken" data-arg="holyrics">Remover token</button></div>
        ${callout("info", "shield", "O Holyrics aceita conexões de outros aparelhos da rede", "O servidor do Holyrics fica disponível para a rede da igreja, sem criptografia. Este app só conversa com o próprio computador, mas outros aparelhos na mesma rede poderiam usar o token. Use uma rede confiável (não a de visitantes) e não compartilhe o token.")}
      </section>
      <section class="ds-card stack-sm settings-section" aria-labelledby="sv-h"><div class="row between"><h2 class="ds-h2" id="sv-h">Videira Music</h2>${vState}</div>
        <dl class="kv"><dt>Igreja</dt><dd>${esc(v.detail.organizationName || "—")}</dd><dt>Token</dt><dd class="mono">${v.status === "notConfigured" ? "—" : "••••7Qx2"}</dd></dl>
        <div class="row-wrap"><button class="ds-button-secondary btn-sm" data-act="testConn" data-arg="videira">Testar</button><button class="ds-button-secondary btn-sm" data-act="swapToken" data-arg="videira">Trocar token</button><button class="ds-button-ghost btn-sm" data-act="openRemoveToken" data-arg="videira">Remover token</button></div>
        <p class="sm muted">Os dois tokens ficam no cofre do Windows (Gerenciador de Credenciais), nunca em arquivo.</p>
      </section>
      <section class="ds-card stack-sm settings-section" aria-labelledby="sr-h"><h2 class="ds-h2" id="sr-h">Lembrete de domingo</h2>
        <label class="check"><input type="checkbox" data-change="reminder" ${S.reminder.enabled ? "checked" : ""}><span>Lembrar de preparar o culto no domingo</span></label>
        <div class="field" style="max-width:12rem"><label for="rem-time">Horário</label><input id="rem-time" type="time" class="ds-input" value="${esc(S.reminder.time)}" data-change="reminderTime" ${S.reminder.enabled ? "" : "disabled"}></div>
        <p class="sm muted">O app nunca publica sozinho; ele só prepara e avisa.</p>
      </section>
      <section class="ds-card stack-sm settings-section" aria-labelledby="sa-h"><h2 class="ds-h2" id="sa-h">Aparência</h2>
        <div class="field"><span class="label" id="lbl-theme">Tema</span>${seg("theme", S.theme, [["system", "Automático"], ["light", "Claro"], ["dark", "Escuro"]])}</div>
        <div class="field"><span class="label">Tamanho do texto</span>${seg("font", S.fontScale, [[1, "Normal"], [1.15, "Grande"], [1.3, "Maior"]])}</div>
      </section>
      <section class="ds-card stack-sm settings-section" aria-labelledby="sb-h"><h2 class="ds-h2" id="sb-h">Bandeja do sistema</h2>
        <label class="check"><input type="checkbox" data-change="trayStart" ${S.tray.startWithOs ? "checked" : ""}><span>Iniciar com o Windows</span></label>
        <label class="check"><input type="checkbox" data-change="trayClose" ${S.tray.closeToTray ? "checked" : ""}><span>Ao fechar a janela, continuar na bandeja</span></label>
        <div><button class="ds-button-secondary btn-sm" data-act="go" data-arg="bandeja">Ver exemplo da bandeja e das notificações</button></div>
      </section>
      <section class="ds-card stack-sm settings-section" aria-labelledby="sd-h"><h2 class="ds-h2" id="sd-h">Dados deste computador</h2>
        <p class="sm muted">Cópia do último setlist, da biblioteca e avisos pendentes. Os vínculos ficam no Videira Music.</p>
        <div class="row-wrap"><button class="ds-button-secondary btn-sm" data-act="dataFolder">Abrir pasta de dados</button><button class="ds-button-secondary btn-sm" data-act="rebuild">Refazer cache</button></div>
      </section>
      <p class="sm subtle">async-videira 0.1.0 (protótipo) · Ajuda: videiramusic.org/ajuda/holyrics</p>`, "");
  }

  // ---------------------------------------------------------------- T9 Bandeja
  function renderBandeja() {
    const c = summary(S.data.items);
    const counted = c.total - c.repeated;
    return page(`
      <div class="page-head"><div><p class="ds-eyebrow">Exemplo</p><h1 class="ds-h1" tabindex="-1">Bandeja e notificações</h1>
      <p class="lead muted">Como o app aparece no Windows quando a janela está fechada. Os textos vêm do app; o visual é do sistema.</p></div>
      <button class="ds-button-secondary" data-act="go" data-arg="ajustes">${icon("back")}Voltar aos ajustes</button></div>
      <div class="desktop-mock" aria-label="Simulação da área de trabalho do Windows">
        <div class="os-toast"><span class="tray-icon" aria-hidden="true">V</span><div><strong>Culto de domingo: 1 música precisa de você</strong><p class="sm muted">“Santo” não está no Holyrics.</p><p class="xs subtle" style="margin-top:.25rem">async-videira · agora</p></div></div>
        <div class="os-toast"><span class="tray-icon" aria-hidden="true">V</span><div><strong>Culto de domingo pronto</strong><p class="sm muted">4 músicas prontas para publicar no Holyrics.</p><p class="xs subtle" style="margin-top:.25rem">async-videira · domingo 08:00</p></div></div>
        <ul class="tray-menu" role="menu" aria-label="Menu da bandeja">
          <li class="info" role="none">${esc(S.data.setlist ? S.data.setlist.title : "Culto de domingo")} — ${c.ready} de ${counted} prontas</li>
          <li class="item" role="menuitem"><strong>Preparar culto</strong></li>
          <li class="item" role="menuitem">Abrir async-videira</li>
          <li class="sep" role="separator"></li>
          <li class="info" role="none">Holyrics: ${S.data.connections.holyrics.status === "ok" ? "conectado" : "⚠ não está respondendo"}</li>
          ${S.data.pendingReports.length ? `<li class="info" role="none">${plural(S.data.pendingReports.length, "aviso pendente", "avisos pendentes")}</li>` : ""}
          <li class="sep" role="separator"></li>
          <li class="item" role="menuitem">Sair</li>
        </ul>
        <div class="taskbar"><span>PT</span><span class="tray-icon" title="async-videira — 1 música precisa de você">V<span class="badge-dot"></span></span><span>09:38</span></div>
      </div>
      <div class="ds-card-muted sm">Ícone com ponto amarelo = há algo a fazer (pendência ou erro). Sem ponto = tudo certo. O app só notifica quando há o que fazer; o resultado de uma publicação aparece na janela, não em notificação.</div>`, "");
  }

  // ---------------------------------------------------------------- T0 Onboarding
  function renderOnboarding() {
    const o = S.onb;
    const steps = [["holyrics", "1 Holyrics"], ["videira", "2 Videira Music"], ["done", "3 Pronto"]];
    const order = ["welcome", "holyrics", "videira", "done"];
    const stepper = `<ol class="stepper" aria-label="Etapas">${steps.map(([k, l]) => `<li class="${order.indexOf(o.step) > order.indexOf(k) ? "done" : ""}" ${o.step === k ? 'aria-current="step"' : ""}>${order.indexOf(o.step) > order.indexOf(k) ? icon("check") : ""}${l}</li>`).join("")}</ol>`;
    let inner = "", bar = "";
    if (o.step === "welcome") {
      inner = `<p class="ds-eyebrow">Primeira configuração</p><h1 class="ds-h1" tabindex="-1">Vamos ligar o Videira Music ao Holyrics</h1>
        <p class="muted">Leva uns 5 minutos e só precisa ser feito uma vez neste computador.</p>${stepper}
        <div class="ds-card-muted" style="color:inherit"><strong>Você vai precisar de:</strong><ul style="list-style:disc;padding-left:1.25rem;margin-top:.5rem"><li>Holyrics aberto neste computador</li><li>Alguém com acesso de administrador da igreja no Videira Music</li></ul></div>
        <p class="sm">${helpLink("comecar", "Como o app funciona")} · ${helpLink("configurar-holyrics", "Guia do técnico: configurar o Holyrics")}</p>`;
      bar = actionBar({ label: "Começar", act: "onbGo", arg: "holyrics" });
    } else if (o.step === "holyrics") {
      const t = o.hTest;
      let res = "";
      if (o.testing === "h") res = `<p role="status" class="sm">Testando…</p>`;
      else if (t && t.result === "ok") res = callout("ok", "check", `Conectado ao Holyrics ${t.version}`, `${t.songCount} músicas na biblioteca. Todas as permissões necessárias estão certas.`, "", "status") + (t.extra.length ? callout("info", "info", "Este token tem permissões que o app não usa", `${esc(t.extra.join(", "))}. Funciona, mas é mais seguro desmarcá-las no Holyrics.`) : "");
      else if (t && t.result === "permissionMissing") res = callout("warn", "shield", `Faltam ${t.missing.length} permissões`, `Abrimos um pedido no Holyrics: clique em <strong>Permitir</strong> na janela que apareceu lá. Faltam: ${t.missing.map((m) => `<code class="mono">${m}</code>`).join(", ")}.`, `<button class="ds-button btn-sm" data-act="testHolyrics">Verificar de novo</button>`, "alert");
      else if (t && t.result === "unreachable") res = callout("danger", "x", "Não encontramos o Holyrics neste computador", "Confira se ele está aberto e se <strong>Ativar (local)</strong> está marcado em Arquivo → Configurações → API Server. Depois de ativar, espere uns 15 segundos.", "", "alert");
      inner = `<p class="ds-eyebrow">Primeira configuração</p><h1 class="ds-h1" tabindex="-1">Conectar ao Holyrics</h1>${stepper}
        <ol class="instructions"><li><span>No Holyrics, abra <strong>Arquivo → Configurações → API Server</strong>.</span></li>
          <li><span>Marque <strong>Ativar (local)</strong>. Deixe a porta <strong>8091</strong>, a não ser que alguém tenha mudado.</span></li>
          <li><span>Clique em <strong>Gerenciar permissões → Criar token</strong> e dê o nome <strong>async-videira</strong>.</span></li>
          <li><span>Na coluna <strong>Local</strong>, marque só as permissões da lista abaixo. Deixe <strong>Web</strong> desmarcado.</span></li>
          <li><span>Copie o token e cole aqui.</span></li></ol>
        <p class="sm">${helpLink("configurar-holyrics", "Ajuda: configurar o Holyrics passo a passo")}</p>
        <details class="ds-card-muted" style="color:inherit"><summary>Permissões necessárias (${D.REQUIRED_PERMISSIONS.length})</summary>
          <p class="sm muted">Estes nomes aparecem iguais no Holyrics. Não marque outras: o app não precisa.</p>
          <div class="perm-list">${D.REQUIRED_PERMISSIONS.map((p) => `<code class="${t && t.missing && t.missing.includes(p) ? "missing" : ""}">${p}</code>`).join("")}</div>
          <button class="ds-button-ghost btn-sm" data-act="copyPerms" style="margin-top:.5rem">${icon("copy")}Copiar lista</button></details>
        <div class="field"><label for="h-token">Token do Holyrics</label><p class="help" id="h-help">16 letras e números. Fica guardado no cofre do Windows, nunca em arquivo.</p>
          <div class="input-row"><input id="h-token" class="ds-input mono" type="${o.showH ? "text" : "password"}" autocomplete="off" spellcheck="false" value="${esc(o.hToken)}" data-input="hToken" aria-describedby="h-help ${o.err.h ? "h-err" : ""}" ${o.err.h ? 'aria-invalid="true"' : ""}>
          <button class="ds-button-secondary" data-act="toggleShow" data-arg="H" aria-pressed="${o.showH}">${o.showH ? "Ocultar" : "Mostrar"}</button></div>
          ${o.err.h ? `<p class="error" id="h-err">${icon("x")}${esc(o.err.h)}</p>` : ""}</div>
        <details><summary>Porta (avançado)</summary><div class="field" style="max-width:10rem"><label for="h-port">Porta</label><input id="h-port" class="ds-input mono" value="8091" inputmode="numeric"></div></details>
        <div aria-live="polite">${res}</div>
        ${callout("info", "shield", "O Holyrics aceita conexões de outros aparelhos da rede", "O servidor do Holyrics fica disponível para a rede da igreja, sem criptografia. Este app só conversa com o próprio computador, mas outros aparelhos na mesma rede Wi-Fi poderiam usar o token. Use uma rede confiável (não a rede de visitantes) e não compartilhe o token.", `<button class="ds-link" data-act="help" data-arg="seguranca-dos-tokens">Saiba como bloquear no firewall</button>`)}`;
      bar = t && t.result === "ok" ? actionBar({ label: "Continuar", act: "onbGo", arg: "videira" }, `<button class="ds-button-secondary" data-act="onbGo" data-arg="welcome">Voltar</button>`)
        : actionBar({ label: o.testing === "h" ? "Testando…" : "Testar conexão", act: "testHolyrics", disabled: o.testing === "h" }, `<button class="ds-button-secondary" data-act="onbGo" data-arg="welcome">Voltar</button>`);
    } else if (o.step === "videira") {
      const t = o.vTest;
      let res = "";
      if (o.testing === "v") res = `<p role="status" class="sm">Testando…</p>`;
      else if (t && t.result === "ok") res = callout("ok", "check", `Conectado à igreja ${esc(t.organizationName)}`, `Próximo culto publicado: ${esc(t.nextSetlist.title)}, ${esc(fmtDay(t.nextSetlist.eventAt))}.`, "", "status");
      else if (t && t.result === "tokenInvalid") res = callout("danger", "x", "O Videira Music recusou este token", "Ele pode ter sido revogado. Peça um novo a quem administra a igreja.", "", "alert");
      inner = `<p class="ds-eyebrow">Primeira configuração</p><h1 class="ds-h1" tabindex="-1">Conectar ao Videira Music</h1>${stepper}
        <ol class="instructions"><li><span>Peça a quem administra a igreja no Videira Music para abrir <strong>videiramusic.org → Integrações → Holyrics</strong>.</span></li>
          <li><span>Em <strong>Tokens da igreja</strong>, clicar em <strong>Gerar token</strong>. O valor aparece uma vez só.</span></li>
          <li><span>Cole aqui.</span></li></ol>
        <p class="sm muted">${icon("shield")} Esse token só permite ler os setlists publicados da igreja e enviar o resultado. Não dá acesso a membros, cifras nem configurações.</p>
        <div class="field"><label for="v-token">Token do Videira Music</label>
          <div class="input-row"><input id="v-token" class="ds-input mono" type="${o.showV ? "text" : "password"}" autocomplete="off" spellcheck="false" value="${esc(o.vToken)}" data-input="vToken" ${o.err.v ? 'aria-invalid="true" aria-describedby="v-err"' : ""}>
          <button class="ds-button-secondary" data-act="toggleShow" data-arg="V" aria-pressed="${o.showV}">${o.showV ? "Ocultar" : "Mostrar"}</button></div>
          ${o.err.v ? `<p class="error" id="v-err">${icon("x")}${esc(o.err.v)}</p>` : ""}</div>
        <div aria-live="polite">${res}</div>`;
      bar = t && t.result === "ok" ? actionBar({ label: "Continuar", act: "onbGo", arg: "done" }, `<button class="ds-button-secondary" data-act="onbGo" data-arg="holyrics">Voltar</button>`)
        : actionBar({ label: o.testing === "v" ? "Testando…" : "Testar conexão", act: "testVideira", disabled: o.testing === "v" }, `<button class="ds-button-secondary" data-act="onbGo" data-arg="holyrics">Voltar</button><button class="ds-button-ghost" data-act="onbGo" data-arg="done">Pular por agora</button>`);
    } else {
      inner = `<p class="ds-eyebrow">Primeira configuração</p><h1 class="ds-h1" tabindex="-1">Tudo pronto</h1>${stepper}
        <div class="row-wrap">${toneChip("ok", "check", "Holyrics 2.30.0 · 29 músicas")}${o.vTest ? toneChip("ok", "check", `Igreja ${o.vTest.organizationName}`) : toneChip("warn", "alert", "Videira Music: configurar depois em Ajustes")}</div>
        <fieldset class="ds-card stack-sm" style="margin-top:1rem"><legend class="ds-h2" style="padding:0 .25rem">Quando preparar o culto?</legend>
          <label class="radio-card"><input type="radio" name="rem" data-change="onbReminder" value="off" ${S.reminder.enabled ? "" : "checked"}><div>Só quando eu abrir o app</div></label>
          <label class="radio-card"><input type="radio" name="rem" data-change="onbReminder" value="on" ${S.reminder.enabled ? "checked" : ""}><div>Lembrar no domingo às ${esc(S.reminder.time)}<div class="sm muted">Mostra uma notificação; não publica sozinho.</div></div></label>
        </fieldset>`;
      bar = actionBar({ label: "Preparar o próximo culto", act: "finishOnb" }, `<button class="ds-button-secondary" data-act="onbGo" data-arg="videira">Voltar</button>`);
    }
    return `<div class="app-main" style="flex:1;min-height:0"><main id="main" class="content" tabindex="-1"><div class="onb stack">${inner}</div></main>${bar}</div>`;
  }

  // ---------------------------------------------------------------- painel do protótipo
  function renderProto() {
    const groups = {};
    Object.entries(D.scenarios).forEach(([k, v]) => { (groups[v.group] = groups[v.group] || []).push([k, v]); });
    return `<button class="proto-toggle" data-act="toggleProto" aria-expanded="${S.protoOpen}" aria-controls="proto-panel">⚙ Protótipo: cenários</button>
      ${S.protoOpen ? `<aside class="proto-panel" id="proto-panel" aria-label="Cenários do protótipo (não faz parte do app)">
        <p class="sm muted">Controles só do protótipo — não fazem parte do app.</p>
        ${Object.entries(groups).map(([g, list]) => `<h2>${esc(g)}</h2>${list.map(([k, v]) => `<button data-act="scenario" data-arg="${k}" aria-pressed="${S.scenario === k}">${esc(v.label)}</button>`).join("")}`).join("")}
        <h2>Holyrics de verdade</h2>
        <button data-act="toggleRealHolyrics" aria-pressed="${S.holyricsReal}">${S.holyricsReal ? "✓ " : ""}Abrir o editor no Holyrics real (${esc(S.holyricsUrl)})</button>
        <p class="xs subtle" style="font-weight:400;margin-top:.25rem">${S.realMsg ? esc(S.realMsg) : "Só o botão “Abrir no Holyrics” vai ao Holyrics real; o resto continua simulado. Precisa de http (node scripts/serve-prototype.mjs)."}</p>
        <h2>Atalhos</h2>
        <button data-act="go" data-arg="bandeja">Bandeja e notificações</button>
        <button data-act="fillTokens">Preencher tokens de exemplo (pareamento)</button>
        <p class="xs subtle" style="margin-top:.5rem;font-weight:400">Token Holyrics 0000000000000000 = recusado · 1111111111111111 = Holyrics fechado. Teclado: Ctrl+1…4 navega, Ctrl+R prepara de novo, Ctrl+Enter aciona o botão principal, Esc fecha diálogo.</p>
      </aside>` : ""}`;
  }

  // ---------------------------------------------------------------- ações
  const A = {
    go(arg) {
      if (arg === "ajuda" || S.screen === "ajuda") S.helpReturn = null;
      if (!S.data.configured && arg !== "onboarding") return;
      if (arg === "culto" && S.screen === "result") A.finish();
      S.screen = arg; S.flash = arg === "review" || arg === "culto" ? S.flash : null; S.settingsMsg = null; S.reportMsg = null; S.restoreMsg = null;
      render();
    },
    scenario(arg) { loadScenario(arg); S.protoOpen = false; render(); announce(`Cenário: ${D.scenarios[arg].label}`); },
    toggleProto() { S.protoOpen = !S.protoOpen; render(); },
    async prepare() {
      S.loading = true; S.flash = null; render(); announce("Preparando o culto…");
      await sleep(900);
      S.loading = false;
      if (S.data.error && S.data.error.code === "VIDEIRA_NO_SETLIST") S.flash = { tone: "info", icon: "info", title: "Ainda nenhum setlist publicado." };
      else S.flash = { tone: "ok", icon: "check", title: `Preparado às ${fmtTime(nowIso())}.`, body: "Setlist, biblioteca e destino lidos agora." };
      render();
    },
    async retryHolyrics() {
      S.loading = true; render(); await sleep(900);
      const fresh = D.scenarios.pronto.data();
      Object.assign(S.data, { connections: fresh.connections, destination: fresh.destination, items: fresh.items, error: null });
      S.loading = false; S.flash = { title: "Holyrics conectado de novo." }; render();
    },
    async retryVideira() {
      S.loading = true; render(); await sleep(900); S.loading = false;
      S.flash = { tone: "warn", icon: "alert", title: "Ainda sem internet.", body: "Tentamos de novo sozinhos a cada 5 minutos." }; render();
    },
    pickSetlist(_, el) {
      const night = el.value === "async-test-setlist-night";
      S.data.setlist = S.data.setlistChoices.find((c) => c.id === el.value);
      S.flash = { tone: "info", icon: "info", title: `Mostrando “${S.data.setlist.title}”.`, body: night ? "Confira se o culto da noite está selecionado no Holyrics." : "" };
      render();
    },
    async recheckDest() {
      const wasSuspect = destSuspect();
      S.flash = null; render(); await sleep(500);
      if (isTemp()) S.flash = { tone: "info", icon: "info", title: "Continua selecionada a playlist temporária.", body: "Se o culto existe na agenda do Holyrics, selecione-o lá; senão, siga com a temporária e confirme antes de substituir." };
      else if (wasSuspect) { S.data.destination = DEST_OK(); S.flash = { title: `Agora está selecionado: ${S.data.destination.name}.` }; }
      else S.flash = { tone: "info", icon: "info", title: `Continua selecionado: ${S.data.destination.name}.` };
      render();
    },
    openChoose(arg) { S.dialog = { type: "choose", pos: arg, pick: null }; render(); },
    pickCandidate(_, el) { S.dialog.pick = el.value; render(); },
    confirmChoose() {
      const it = S.data.items.find((i) => i.position === Number(S.dialog.pos));
      const snap = snapshot();
      if (S.dialog.pick === "none") { it.state = "missing"; it.candidates = []; S.flash = { tone: "info", icon: "info", title: `“${it.song.title}” ficou como “Não está no Holyrics”.`, undo: snap }; }
      else { const c = it.candidates.find((x) => x.id === S.dialog.pick); it.state = "ready"; it.holyrics = c; it.matchedBy = "externalId"; S.flash = { title: `“${it.song.title}” vinculada.`, undo: snap }; S.sessionLinks.unshift({ title: it.song.title, artist: it.song.artist, holyricsId: c.id, since: nowIso(), source: "individual" }); }
      S.dialog = null; render(); announce(S.flash.title);
    },
    openMissing(arg) { S.dialog = newMissingDialog(arg); render(); },
    async openEditor() {
      const g = S.dialog, it = S.data.items.find((i) => i.position === Number(g.pos));
      if (Date.now() < (S.editorCooldownUntil || 0)) return;
      g.editor = "opening"; g.errorCode = null; render();
      S.editorCooldownUntil = Date.now() + 2000; // o Holyrics aceita 1 chamada a cada 2 s
      setTimeout(() => { if (S.dialog === g) render(); }, 2050);
      let r;
      if (S.holyricsReal) r = await requestHolyricsEditor(it.song);
      else { await sleep(600); r = g.simEditor === "opaque" ? { kind: "opaque" } : g.simEditor && g.simEditor !== "opened" ? { kind: "error", code: g.simEditor } : { kind: "opened" }; }
      if (S.dialog !== g) return;
      g.previousCatalogTaken = true; // no app real: snapshot GetSongs ANTES de abrir, para song.awaitCreated
      if (r.kind === "opened") { g.editor = "opened"; g.confirmedBy = "status"; announce("O editor abriu no Holyrics."); }
      else if (r.kind === "opaque") {
        g.editor = "requested"; announce("Pedimos ao Holyrics para abrir o editor. Olhe a janela do Holyrics.");
        setTimeout(() => { if (S.dialog === g && g.editor === "requested") { g.editor = "askConfirm"; render(); announce("O editor abriu? Responda no diálogo."); } }, S.askAfterMs);
      } else { g.editor = "error"; g.errorCode = r.code; announce((EDITOR_ERRORS[r.code] || EDITOR_ERRORS.EDITOR_FAILED)[0]); }
      render();
    },
    editorConfirm(arg) { const g = S.dialog; g.editor = arg === "yes" ? "opened" : "notOpened"; g.confirmedBy = arg === "yes" ? "operator" : null; render(); },
    pickNew(_, el) { S.dialog.pick = el.value; render(); },
    confirmCreated() {
      const g = S.dialog, it = S.data.items.find((i) => i.position === Number(g.pos));
      const song = g.reread === "ambiguous" ? g.candidates.find((c) => c.id === g.pick) : g.found;
      if (!song) return;
      const snap = snapshot();
      it.state = "ready"; it.holyrics = { id: song.id, title: song.title, artist: song.artist }; it.matchedBy = "externalId";
      it.lyricsPlaceholder = g.reread === "placeholder";
      S.sessionLinks.unshift({ title: it.song.title, artist: it.song.artist, holyricsId: song.id, since: nowIso(), source: "individual" });
      S.dialog = null;
      S.flash = it.lyricsPlaceholder
        ? { tone: "warn", icon: "alert", title: `“${it.song.title}” vinculada, mas ainda sem letra.`, body: `Troque ${PLACEHOLDER} pela letra no Holyrics antes do culto.`, undo: snap }
        : { title: `“${it.song.title}” vinculada.`, body: "Nas próximas semanas ela entra sozinha.", undo: snap };
      render(); announce(S.flash.title);
    },
    toggleRealHolyrics() {
      if (location.protocol === "file:") { S.realMsg = "Abra pelo servidor: node scripts/serve-prototype.mjs e acesse http://localhost:5177/?holyrics=real"; render(); return; }
      S.holyricsReal = !S.holyricsReal; S.realMsg = null; render();
    },
    openSearch() { S.dialog.search = ""; render(); const i = document.getElementById("lib-search"); i && i.focus(); },
    linkManual(arg) {
      const it = S.data.items.find((i) => i.position === Number(S.dialog.pos));
      const s = librarySearch(S.dialog.search || "").find((x) => x.id === arg) || librarySearch("").find((x) => x.id === arg);
      const snap = snapshot();
      it.state = "ready"; it.holyrics = s; it.matchedBy = "externalId";
      S.sessionLinks.unshift({ title: it.song.title, artist: it.song.artist, holyricsId: s.id, since: nowIso(), source: "individual" });
      S.dialog = null; S.flash = { title: `“${it.song.title}” vinculada a “${s.title}”.`, undo: snap }; render();
    },
    async reread() {
      // Simula song.awaitCreated (IDs novos com título+artista exatos) + leitura da letra (GetLyrics) para achar o placeholder.
      const g = S.dialog; g.reread = "reading"; g.pick = null; render(); await sleep(900);
      if (S.dialog !== g) return;
      const it = S.data.items.find((i) => i.position === Number(g.pos));
      const sim = it.simCreated || {};
      let outcome = g.simReread;
      if (!outcome) outcome = g.tries === 0 && !g.editor ? "notFound" : "created";
      g.simReread = outcome === "placeholder" ? "created" : null; // depois de corrigir a letra, a próxima leitura encontra limpa
      g.tries++;
      g.reread = outcome;
      if (outcome === "created" || outcome === "placeholder") g.found = sim.song;
      if (outcome === "ambiguous") g.candidates = sim.ambiguous;
      render();
      announce({ created: "Encontramos a música nova.", placeholder: "A música foi salva, mas a letra ainda é o texto provisório.", notFound: "Ainda não encontramos a música nova.", ambiguous: "Encontramos mais de uma música nova com este nome." }[outcome]);
    },
    // Ajuda: abrir um tópico guarda de onde veio (tela + diálogo) para o botão Voltar.
    help(arg) {
      if (S.screen !== "ajuda") S.helpReturn = { screen: S.screen, dialog: S.dialog };
      S.dialog = null; S.screen = "ajuda";
      S.help.topic = HELP_BY_ID[arg] ? arg : "comecar"; S.help.query = ""; S.help.copyMsg = null; S.help.focusTitle = true;
      render();
    },
    helpTopic(arg) { if (!HELP_BY_ID[arg]) return; S.help.topic = arg; S.help.copyMsg = null; S.help.focusTitle = true; render(); },
    helpJump(arg) { const h = document.getElementById(arg); if (h) { h.scrollIntoView({ block: "start" }); h.focus({ preventScroll: true }); } },
    helpBack() {
      const r = S.helpReturn; S.helpReturn = null;
      if (r) { S.screen = r.screen; S.dialog = r.dialog; } else S.screen = S.data.configured ? "culto" : "onboarding";
      render();
    },
    helpClear() { S.help.query = ""; render(); const i = document.getElementById("help-search"); i && i.focus(); },
    helpFb(arg) { save("help-fb-" + S.help.topic, arg); render(); announce("Obrigado pela resposta."); },
    async helpCopy() {
      try { await navigator.clipboard.writeText(supportInfo()); S.help.copyMsg = "Copiado. Cole na mensagem para o suporte."; }
      catch { S.help.copyMsg = "Não deu para copiar sozinho: abra “O que é copiado” e copie o texto."; S.helpDiagOpen = true; }
      render();
    },
    toggleSel(arg, el) { S.review.sel[arg] = el.checked; render(); },
    selAll(arg) { S.data.items.filter((i) => i.state === "needsLink").forEach((i) => { S.review.sel[i.songId] = arg === "1"; }); render(); },
    songView(arg) { S.songView = arg; render(); },
    toggleCol(arg) { S.dialog[arg] = !S.dialog[arg]; render(); },
    async linkBatch() {
      const batch = S.data.items.filter((i) => i.state === "needsLink" && S.review.sel[i.songId] !== false);
      if (!batch.length) return;
      const snap = snapshot();
      S.linking = true; render(); await sleep(800); S.linking = false;
      batch.forEach((i) => { i.state = "ready"; i.holyrics = i.suggestion; i.matchedBy = "externalId"; S.sessionLinks.unshift({ title: i.song.title, artist: i.song.artist, holyricsId: i.suggestion.id, since: nowIso(), source: i.staleLink ? "reconciliation" : "batch" }); i.staleLink = null; });
      // itens repetidos que dependiam do mesmo vínculo continuam "repetida"
      S.flash = { kind: "linked", title: `${plural(batch.length, "vínculo confirmado", "vínculos confirmados")}.`, body: "Nas próximas semanas estas músicas entram sozinhas.", undo: snap };
      render(); announce(S.flash.title);
    },
    undoFlash() {
      if (!S.flash || !S.flash.undo) return;
      S.data.items = S.flash.undo.items; S.sessionLinks = S.flash.undo.links;
      S.flash = { tone: "info", icon: "undo", title: "Desfeito." }; render(); announce("Desfeito.");
    },
    openConfirm() { S.dialog = { type: "confirm", ackPartial: false, ackDest: false }; render(); },
    ackPartial(_, el) { S.dialog.ackPartial = el.checked; render(); },
    ackDest(_, el) { S.dialog.ackDest = el.checked; render(); },
    apply() { runApply(); },
    finish() { S.screen = "culto"; S.flash = null; S.restoreMsg = null; render(); },
    openRestore() { S.dialog = { type: "restore", busy: false }; render(); },
    async doRestore() {
      S.dialog.busy = true; render(); await sleep(1200);
      S.data.destination = { ...S.data.destination, currentItems: S.result.originalPlaylist };
      S.data.alreadyApplied = false;
      S.result.canRestore = false; S.dialog = null; S.restoreMsg = "Playlist restaurada e conferida. As músicas de antes estão de volta.";
      S.result.playlistNow = S.result.originalPlaylist;
      render(); announce(S.restoreMsg);
    },
    async copyList() {
      const text = S.result.originalPlaylist.map((s, i) => `${i + 1}. ${s.title} — ${s.artist}`).join("\n");
      try { await navigator.clipboard.writeText(text); S.flash = { title: "Lista copiada." }; } catch { S.flash = { tone: "warn", icon: "alert", title: "Não foi possível copiar. Selecione a lista e copie à mão." }; }
      render();
    },
    async copyTech() { try { await navigator.clipboard.writeText("código: …"); } catch { /* protótipo */ } announce("Detalhes copiados."); },
    async copyPerms() { try { await navigator.clipboard.writeText(D.REQUIRED_PERMISSIONS.join(", ")); } catch { /* protótipo */ } announce("Lista de permissões copiada."); },
    reconSel(arg, el) { S.recon.sel[arg] = el.checked; render(); },
    reconPick(arg, el) { S.recon.picks[arg] = el.value; render(); },
    confirmRecon() {
      const n = D.reconciliation.batch.filter((b) => S.recon.sel[b.songId] !== false).length + Object.values(S.recon.picks).filter((v) => v !== "later").length;
      S.recon.done = true; S.data.reconciliation.active = false;
      S.data.items.forEach((i) => { if (i.staleLink && S.recon.sel[i.songId] !== false) { i.state = "ready"; i.holyrics = i.suggestion; i.matchedBy = "externalId"; i.staleLink = null; } });
      S.flash = { title: `${plural(n, "vínculo atualizado", "vínculos atualizados")}.`, body: "Os antigos ficaram no histórico." };
      render(); announce(S.flash.title);
    },
    async sendReports() {
      S.sending = true; render(); await sleep(900); S.sending = false;
      if (S.data.connections.videira.status !== "ok") S.reportMsg = { tone: "warn", title: "Ainda sem internet.", body: "Os avisos continuam guardados. Tentamos de novo sozinhos a cada 5 minutos." };
      else { S.data.pendingReports = []; S.reportMsg = { tone: "ok", title: "Avisos enviados ao Videira Music." }; }
      render();
    },
    "set-theme"(arg) { S.theme = arg; save("theme", arg); render(); },
    "set-font"(arg) { S.fontScale = Number(arg); save("fontScale", arg); render(); },
    reminder(_, el) { S.reminder.enabled = el.checked; S.settingsMsg = el.checked ? "Lembrete ligado." : "Lembrete desligado."; render(); },
    reminderTime(_, el) { S.reminder.time = el.value; S.settingsMsg = `Lembrete às ${el.value}.`; render(); },
    trayStart(_, el) { S.tray.startWithOs = el.checked; render(); },
    trayClose(_, el) { S.tray.closeToTray = el.checked; render(); },
    async testConn(arg) { S.settingsMsg = null; render(); await sleep(600); const c = S.data.connections[arg]; S.settingsMsg = c.status === "ok" ? `${arg === "holyrics" ? "Holyrics" : "Videira Music"}: conexão funcionando.` : "Ainda com problema — veja a mensagem na tela Culto."; render(); },
    swapToken(arg) { S.onb = { step: arg, hToken: "", vToken: "", hTest: null, vTest: null, hTries: 1, err: {}, testing: null, returnTo: "ajustes" }; S.screen = "onboarding"; render(); },
    openRemoveToken(arg) { S.dialog = { type: "removeToken", service: arg }; render(); },
    doRemoveToken() { const svc = S.dialog.service; S.data.connections[svc] = { status: "notConfigured", detail: {} }; S.dialog = null; S.settingsMsg = `Token do ${svc === "holyrics" ? "Holyrics" : "Videira Music"} removido deste computador.`; render(); },
    dataFolder() { S.settingsMsg = "Abrimos a pasta %APPDATA%\\async-videira."; render(); },
    async rebuild() { S.settingsMsg = "Refazendo cache…"; render(); await sleep(900); S.settingsMsg = "Cache refeito. Vínculos não foram afetados."; render(); },
    overlay(_, el, ev) { if (ev.target === el && !(S.dialog && S.dialog.busy) && S.dialog.type !== "confirm") { S.dialog = null; render(); } },
    closeDialog() { if (S.dialog && S.dialog.busy) return; S.dialog = null; render(); },
    // onboarding
    onbGo(arg) {
      const o = S.onb;
      if (o.returnTo) { // troca de token a partir de Ajustes: qualquer navegação volta para lá
        const ok = (o.step === "holyrics" && o.hTest && o.hTest.result === "ok") || (o.step === "videira" && o.vTest && o.vTest.result === "ok");
        S.screen = o.returnTo; S.settingsMsg = ok ? "Token trocado e testado." : null; render(); return;
      }
      o.step = arg; o.err = {}; render();
    },
    toggleShow(arg) { S.onb["show" + arg] = !S.onb["show" + arg]; render(); },
    fillTokens() { if (S.screen !== "onboarding") { loadScenario("primeira"); } S.onb.hToken = "aZ3kP9qL2mX7vB1c"; S.onb.vToken = "vm_live_7Qx2…exemplo"; S.protoOpen = false; render(); },
    async testHolyrics() {
      const o = S.onb, tok = o.hToken.trim();
      o.err = {};
      if (!tok) { o.err.h = "Cole o token do Holyrics."; render(); document.getElementById("h-token").focus(); return; }
      if (!/^[A-Za-z0-9]{16}$/.test(tok)) { o.err.h = "O token tem 16 letras e números. Confira se copiou inteiro, sem espaços."; render(); document.getElementById("h-token").focus(); return; }
      o.testing = "h"; o.hTest = null; render(); await sleep(900); o.testing = null;
      if (tok === "0000000000000000") { o.err.h = "O Holyrics não reconheceu este token. Copie de novo em Gerenciar permissões."; }
      else if (tok === "1111111111111111") { o.hTest = { result: "unreachable" }; }
      else if (o.hTries === 0) { o.hTest = { result: "permissionMissing", missing: ["GetSongs", "GetCurrentSchedule"] }; o.hTries++; }
      else { o.hTest = { result: "ok", version: "2.30.0", songCount: 29, extra: ["ActionNext", "ActionPrevious"] }; }
      render();
      if (o.returnTo && o.hTest && o.hTest.result === "ok") { S.data.connections.holyrics = { status: "ok", detail: { version: "2.30.0", port: 8091, songCount: 29, plan: "none" } }; S.data.error = null; }
    },
    async testVideira() {
      const o = S.onb; o.err = {};
      if (!o.vToken.trim()) { o.err.v = "Cole o token do Videira Music."; render(); document.getElementById("v-token").focus(); return; }
      o.testing = "v"; render(); await sleep(900); o.testing = null;
      if (o.vToken.trim() === "0") o.vTest = { result: "tokenInvalid" };
      else o.vTest = { result: "ok", organizationName: "Igreja Videira Centro", nextSetlist: { title: "Culto de domingo — manhã", eventAt: "2026-11-01T10:00:00-03:00" } };
      if (o.returnTo && o.vTest.result === "ok") { S.data.connections.videira = { status: "ok", detail: { organizationName: "Igreja Videira Centro" } }; if (S.data.error && S.data.error.code === "VIDEIRA_TOKEN_INVALID") { const f = D.scenarios.pronto.data(); S.data.setlist = f.setlist; S.data.items = f.items; S.data.error = null; } }
      render();
    },
    onbReminder(_, el) { S.reminder.enabled = el.value === "on"; render(); },
    finishOnb() {
      S.data.configured = true; S.screen = "culto"; S.flash = { title: "Configuração concluída.", body: "Este é o culto de domingo. Revise e publique." }; render();
    },
  };

  // ---------------------------------------------------------------- eventos
  document.addEventListener("click", (ev) => {
    const el = ev.target.closest("[data-act]");
    if (!el || el.disabled) return;
    const fn = A[el.dataset.act];
    if (!fn) return;
    if (el.dataset.act === "overlay") { fn(null, el, ev); return; }
    ev.preventDefault();
    fn(el.dataset.arg, el, ev);
  });
  document.addEventListener("change", (ev) => {
    const el = ev.target.closest("[data-change]");
    if (el && A[el.dataset.change]) A[el.dataset.change](el.dataset.arg, el, ev);
  });
  document.addEventListener("input", (ev) => {
    const el = ev.target.closest("[data-input]");
    if (!el) return;
    const k = el.dataset.input;
    if (k === "helpSearch") { S.help.query = el.value; render(); const i = document.getElementById("help-search"); i.focus(); i.setSelectionRange(i.value.length, i.value.length); return; }
    if (k === "libSearch") { S.dialog.search = el.value; render(); const i = document.getElementById("lib-search"); i.focus(); i.setSelectionRange(i.value.length, i.value.length); return; }
    S.onb[k] = el.value; // sem re-render ao digitar
  });
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "F1") { ev.preventDefault(); if (!(S.dialog && S.dialog.busy) && S.screen !== "progress") A.help(contextTopic()); return; }
    if (ev.key === "Escape") {
      if (S.dialog && !S.dialog.busy) { S.dialog = null; render(); }
      else if (S.protoOpen) { S.protoOpen = false; render(); }
      return;
    }
    if (ev.key === "Tab" && S.dialog) {
      const f = [...$dialog.querySelectorAll("button:not([disabled]), input:not([disabled]), select, [href]")];
      if (!f.length) return;
      if (ev.shiftKey && document.activeElement === f[0]) { ev.preventDefault(); f[f.length - 1].focus(); }
      else if (!ev.shiftKey && document.activeElement === f[f.length - 1]) { ev.preventDefault(); f[0].focus(); }
      return;
    }
    if (S.dialog || S.screen === "progress") return;
    const ctrl = ev.ctrlKey || ev.metaKey;
    if (ctrl && ["1", "2", "3", "4"].includes(ev.key) && S.data.configured) { ev.preventDefault(); A.go(["culto", "vinculos", "historico", "ajustes"][Number(ev.key) - 1]); }
    else if ((ctrl && ev.key.toLowerCase() === "r") || ev.key === "F5") { if (S.screen === "culto") { ev.preventDefault(); A.prepare(); } }
    else if (ctrl && ev.key === "Enter") { const b = document.querySelector(".action-bar [data-primary]:not([disabled])"); if (b) { ev.preventDefault(); b.click(); } }
  });
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { if (S.theme === "system") render(); });
  // <details> nativo: guarda aberto/fechado para sobreviver ao próximo render (toggle não borbulha).
  document.addEventListener("toggle", (ev) => { const k = ev.target.dataset && ev.target.dataset.toggle; if (k) S[k] = ev.target.open; }, true);

  // Deep-link para revisão: index.html?cenario=pendencias&tela=review&dialogo=confirm
  const qs = new URLSearchParams(location.search);
  const startScenario = D.scenarios[qs.get("cenario")] ? qs.get("cenario") : "feliz";
  loadScenario(startScenario);
  if (qs.get("tela") && S.data.configured) S.screen = qs.get("tela");
  // ?tela=ajuda&topico=<id>&busca=<texto> (a Ajuda abre mesmo antes da primeira configuração)
  if (qs.get("tela") === "ajuda") { S.screen = "ajuda"; if (HELP_BY_ID[qs.get("topico")]) S.help.topic = qs.get("topico"); if (qs.get("busca")) S.help.query = qs.get("busca"); }
  if (qs.get("onb")) S.onb.step = qs.get("onb");
  const dlg = qs.get("dialogo");
  if (dlg === "confirm") S.dialog = { type: "confirm", ackPartial: false, ackDest: false };
  if (dlg === "choose" || dlg === "missing") { const it = S.data.items.find((i) => i.state === (dlg === "choose" ? "chooseVersion" : "missing")); if (it) S.dialog = dlg === "choose" ? { type: "choose", pos: it.position, pick: null } : newMissingDialog(it.position); }
  // ?holyrics=real (só via http) · ?holyricsUrl=http://127.0.0.1:8091 · ?pergunta=ms (tempo até "O editor abriu?")
  if (qs.get("holyrics") === "real" && location.protocol !== "file:") S.holyricsReal = true;
  if (qs.get("holyricsUrl")) S.holyricsUrl = qs.get("holyricsUrl");
  if (qs.get("pergunta")) S.askAfterMs = Math.max(500, Number(qs.get("pergunta")) || 4000);
  if (S.dialog && S.dialog.type === "missing") {
    const g = S.dialog, it = S.data.items.find((i) => i.position === g.pos), sim = it.simCreated || {};
    // estados do editor: ?editor=aguardando|pergunta|aberto|naoabriu|jaaberto|fechado
    const ed = { aguardando: ["requested"], pergunta: ["askConfirm"], aberto: ["opened"], naoabriu: ["notOpened"], jaaberto: ["error", "EDITOR_ALREADY_OPEN"], fechado: ["error", "HOLYRICS_UNREACHABLE"] }[qs.get("editor")];
    if (ed) { g.editor = ed[0]; g.errorCode = ed[1] || null; }
    // simulação do clique: ?resposta=opaco|jaaberto|fechado
    g.simEditor = { opaco: "opaque", jaaberto: "EDITOR_ALREADY_OPEN", fechado: "HOLYRICS_UNREACHABLE" }[qs.get("resposta")] || null;
    // resultado da releitura: ?releitura=encontrada|placeholder|naoencontrada|ambigua
    const rr = { encontrada: "created", placeholder: "placeholder", naoencontrada: "notFound", ambigua: "ambiguous" }[qs.get("releitura")];
    if (rr) { g.editor = g.editor || "opened"; g.reread = rr; g.tries = 1; g.found = sim.song; g.candidates = sim.ambiguous || []; }
    // próxima leitura ao clicar: ?proxima=encontrada|placeholder|naoencontrada|ambigua
    const nx = { encontrada: "created", placeholder: "placeholder", naoencontrada: "notFound", ambigua: "ambiguous" }[qs.get("proxima")];
    if (nx) g.simReread = nx;
  }
  if (qs.get("tema")) S.theme = qs.get("tema");
  // ?antes=0|7|15: tamanho da playlist atual no destino (teste do diálogo de substituição)
  if (qs.has("antes") && S.data.destination) {
    const n = Math.max(0, Math.min(15, Number(qs.get("antes")) || 0));
    S.data.destination = { ...S.data.destination, currentItems: D.PLAYLIST_LONG.slice(0, n) };
  }
  if (qs.get("expandir") === "1" && S.dialog) { S.dialog.allBefore = true; S.dialog.allAfter = true; }
  render();
  if (qs.get("acao") === "vincular") A.linkBatch(); // estado de sucesso com Desfazer
})();
