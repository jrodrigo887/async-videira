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
  };
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

  // ---------------------------------------------------------------- derivados
  function summary(items) {
    const c = { total: items.length, ready: 0, needsLink: 0, chooseVersion: 0, missing: 0, repeated: 0 };
    items.forEach((i) => { c[i.state]++; });
    return c;
  }
  const holyricsDown = () => S.data.connections.holyrics.status !== "ok";
  const targetItems = () => S.data.items.filter((i) => i.state === "ready");
  const leftOut = () => S.data.items.filter((i) => ["needsLink", "chooseVersion", "missing"].includes(i.state));
  const destSuspect = () => S.data.destination && S.data.destination.check !== "match";

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
    return { label: "Publicar no Holyrics", act: "openConfirm", hint: `A playlist de “${esc(d.destination.name)}” será substituída. Você confirma antes.` };
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
        ${S.screen === "onboarding" ? renderOnboarding() : renderShell()}
      </div>`;
    $dialog.innerHTML = S.dialog ? renderDialog() : "";
    $proto.innerHTML = renderProto();

    // foco: troca de tela → h1; diálogo aberto → autofocus; senão preserva
    if (S.dialog && !dialogWasOpen) {
      dialogReturnKey = focusKey;
      const t = $dialog.querySelector("[data-autofocus]") || $dialog.querySelector("button, input, select");
      t && t.focus();
    } else if (!S.dialog && dialogWasOpen) {
      restoreFocus(dialogReturnKey);
    } else if (S.screen !== lastScreen) {
      const h1 = $app.querySelector("h1");
      h1 && h1.focus({ preventScroll: true });
    } else {
      restoreFocus(focusKey);
    }
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
            <button class="nav-item" data-act="go" data-arg="${k}" ${current === k ? 'aria-current="page"' : ""} aria-label="${label}${k === "historico" && pending ? `, ${pending} pendentes` : ""}${k === "vinculos" && reconCount ? `, ${reconCount} para revisar` : ""}" title="${label} (Ctrl+${n})">
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
      default: return page("<h1>?</h1>");
    }
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
      banners += callout("danger", "x", "O Holyrics não está respondendo", "Abra o Holyrics neste computador. Se ele já está aberto, confira <strong>Arquivo → Configurações → API Server → Ativar (local)</strong>. Depois de ativar, espere uns 15 segundos.", `<button class="ds-button btn-sm" data-act="retryHolyrics">${icon("refresh")}Tentar de novo</button>${techDetails(err)}`, "alert");
    } else if (err && err.code === "HOLYRICS_TOKEN_INVALID") {
      banners += callout("danger", "x", "O Holyrics não aceita mais o token", "Ele pode ter sido apagado em <strong>Gerenciar permissões</strong> no Holyrics. Crie um novo e cole em Ajustes.", `<button class="ds-button btn-sm" data-act="go" data-arg="ajustes">Trocar token</button>${techDetails(err)}`, "alert");
    } else if (err && err.code === "HOLYRICS_PERMISSION_MISSING") {
      banners += callout("danger", "shield", "Falta permissão no Holyrics", `Abrimos um pedido no Holyrics: clique em <strong>Permitir</strong> na janela que apareceu lá. Falta: <code class="mono">${esc(err.params.missing.join(", "))}</code>.`, `<button class="ds-button btn-sm" data-act="retryHolyrics">${icon("refresh")}Verificar de novo</button>`, "alert");
    } else if (err && err.code === "VIDEIRA_TOKEN_INVALID") {
      banners += callout("danger", "x", "O Videira Music recusou o token", "Ele pode ter sido revogado. Peça um novo a quem administra a igreja no Videira Music e cole em Ajustes.", `<button class="ds-button btn-sm" data-act="go" data-arg="ajustes">Trocar token</button>${techDetails(err)}`, "alert");
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
      banners += callout("info", "info", "A biblioteca de músicas do Holyrics mudou", `Parece que o Holyrics foi reinstalado ou as músicas foram importadas de novo. ${d.reconciliation.affectsCurrentSetlist ? `${plural(d.items.filter((i) => i.staleLink).length, "música deste culto precisa", "músicas deste culto precisam")} ser vinculadas outra vez.` : "Isso não afeta o culto de domingo."} Nenhum vínculo antigo é apagado.`, `<button class="ds-button-secondary btn-sm" data-act="go" data-arg="vinculos">Revisar vínculos</button>`);
    }

    if (err && err.code === "VIDEIRA_NO_SETLIST") {
      return page(`
        <div class="page-head"><div><p class="ds-eyebrow">Próximo culto</p><h1 class="ds-h1" tabindex="-1">Nenhum culto publicado ainda</h1>
        <p class="lead muted">Quando o setlist de domingo for publicado no Videira Music, ele aparece aqui.</p></div></div>
        ${banners}
        <div class="ds-card-muted">Quem publica é a liderança de louvor, no Videira Music. O app procura de novo sozinho no domingo às ${esc(S.reminder.time)}.</div>`, actionBar(primaryForCulto()));
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
    const typeLabel = { service: "Culto", event: "Evento", temporary: "Playlist temporária" }[dest.type];
    let check;
    if (dest.check === "match") check = toneChip("ok", "check", "Mesmo dia do setlist");
    else if (dest.check === "temporary") check = callout("warn", "alert", "Está selecionada a playlist Temporário, não um culto", "Se o culto de domingo já existe no Holyrics, selecione-o lá e clique em Verificar de novo.");
    else if (dest.check === "dateMismatch") check = callout("warn", "alert", `O culto selecionado é de ${esc(fmtDate(dest.datetime).slice(0, 5))}, o setlist é de ${esc(fmtDate(S.data.setlist.eventAt).slice(0, 5))}`, "Confira se é o culto certo. Se não for, selecione o culto certo no Holyrics.");
    return `
      <section class="ds-card stack-sm dest-card" aria-labelledby="dest-h">
        <div><h2 class="ds-h2" id="dest-h">Destino no Holyrics</h2><p class="dest-name">${esc(dest.name)}</p>
          <p class="sm muted">${esc(typeLabel)}${dest.datetime ? ` · ${esc(fmtShort(dest.datetime))}` : ""} · ${plural(dest.currentItems.length, "música", "músicas")} na playlist agora</p></div>
        <div class="dest-check">${check}</div>
        ${dest.check !== "match" ? "" : `<p class="sm muted dest-help">O app só consegue mudar o culto que está <strong>selecionado</strong> no Holyrics. Para trocar, selecione o culto lá e clique em Verificar de novo.</p>`}
        <button class="ds-button-secondary btn-sm dest-btn" data-act="recheckDest">${icon("refresh")}Verificar de novo</button>
      </section>`;
  }

  function renderSongs() {
    const items = S.data.items;
    const c = summary(items);
    const counted = c.total - c.repeated;
    const chips = Object.keys(STATE_META).filter((k) => c[k] > 0).map((k) => chip(k, `${c[k]} ${c[k] === 1 && k === "ready" ? "pronta" : STATE_META[k].many}`)).join("");
    if (!items.length) return `<h2 class="ds-h2" id="songs-h">Músicas do setlist</h2><p class="muted" style="margin-top:.5rem">Este setlist não tem músicas. Peça à liderança para conferir no Videira Music.</p>`;
    return `
      <div class="row between"><h2 class="ds-h2" id="songs-h">Músicas do setlist</h2></div>
      <div class="summary" style="margin-top:.75rem"><strong>${c.ready} de ${counted} ${counted === 1 ? "música pronta" : "músicas prontas"}</strong><span class="row-wrap">${chips}</span></div>
      <ol class="song-list">${items.map(renderSongRow).join("")}</ol>`;
  }

  function renderSongRow(it) {
    const meta = STATE_META[it.state];
    let support = esc(it.song.artist);
    let action = "";
    if (it.state === "needsLink") {
      support = it.staleLink ? "A música vinculada não existe mais nesta biblioteca. Achamos uma igual." : `Achamos “${esc(it.suggestion.title)}” de ${esc(it.suggestion.artist)} no Holyrics com o mesmo nome.`;
      action = `<button class="ds-button-secondary btn-sm" data-act="go" data-arg="review">Revisar</button>`;
    } else if (it.state === "chooseVersion") {
      support = `Há ${it.candidates.length} músicas com este nome no Holyrics.`;
      action = `<button class="ds-button-secondary btn-sm" data-act="openChoose" data-arg="${it.position}">Escolher</button>`;
    } else if (it.state === "missing") {
      support = "Precisa ser cadastrada no Holyrics antes.";
      action = `<button class="ds-button-secondary btn-sm" data-act="openMissing" data-arg="${it.position}">Como resolver</button>`;
    } else if (it.state === "repeated") {
      support = `Já está na posição ${it.repeatOf + 1}. O Holyrics não aceita a mesma música duas vezes na playlist.`;
    }
    return `<li class="song-row ${it.state === "repeated" ? "is-repeated" : ""}" aria-label="Posição ${it.position + 1}, ${esc(it.song.title)}, ${esc(it.song.artist)}, ${meta.label}">
      <span class="song-pos" aria-hidden="true">${it.position + 1}</span>
      <div><p class="song-title">${esc(it.song.title)}</p><p class="song-meta">${it.state === "ready" ? esc(it.song.artist) : `${esc(it.song.artist)} · ${support}`}</p></div>
      ${chip(it.state)}
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

    const batchHtml = batch.length ? `
      <section class="ds-card stack-sm" aria-labelledby="batch-h">
        <h2 class="ds-h2" id="batch-h">Encontramos ${plural(batch.length, "música", "músicas")} com o mesmo nome e artista</h2>
        <p class="sm muted">Confira se são as mesmas. Desmarque a que não for. Depois de vincular, nas próximas semanas elas entram sozinhas.</p>
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
      </section>` : "";

    const indHtml = individual.length ? `
      <section class="ds-card stack-sm" aria-labelledby="ind-h">
        <h2 class="ds-h2" id="ind-h">Escolha a versão certa</h2>
        <p class="sm muted">Há mais de uma música com o mesmo nome no Holyrics. Escolha uma por vez.</p>
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
      ? { label: S.linking ? "Vinculando…" : `Vincular ${plural(selCount, "música", "músicas")}`, act: "linkBatch", disabled: selCount === 0 || S.linking, hint: selCount === 0 ? "Marque ao menos uma música." : "O vínculo fica salvo no Videira Music." }
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
      return dialogShell(`Qual “${esc(it.song.title)}” é a do setlist?`,
        `<p class="sm muted">No Videira: <strong>${esc(it.song.title)}</strong> — ${esc(it.song.artist)}. No Holyrics há ${it.candidates.length} com este nome:</p>
         <fieldset style="border:0;padding:0;margin:0" class="stack-sm"><legend class="sr-only">Versões no Holyrics</legend>${opts}
         <label class="radio-card"><input type="radio" name="pick" value="none" data-change="pickCandidate" ${g.pick === "none" ? "checked" : ""}><div><strong>Nenhuma destas</strong><div class="sm muted">A música fica como “Não está no Holyrics”.</div></div></label></fieldset>`,
        `<span class="why">${g.pick ? "" : "Escolha uma opção."}</span><button class="ds-button-secondary" data-act="closeDialog">Cancelar</button><button class="ds-button" data-act="confirmChoose" ${g.pick ? "" : "disabled"}>Usar esta versão</button>`);
    }
    if (g.type === "missing") {
      const it = item(g.pos);
      const status = g.reread === "reading" ? `<p class="sm" role="status">Lendo a biblioteca do Holyrics…</p>`
        : g.reread === "notFound" ? callout("warn", "alert", `Ainda não encontramos “${esc(it.song.title)}”`, "Confira se salvou a música no Holyrics com o mesmo nome e artista.", "", "status") : "";
      const results = g.search != null ? `<div class="field"><label for="lib-search">Procurar na biblioteca do Holyrics</label><input id="lib-search" class="ds-input" data-input="libSearch" value="${esc(g.search)}" placeholder="Nome ou artista"></div>
        <ul class="list-rows">${librarySearch(g.search).map((s) => `<li><div class="grow"><strong>${esc(s.title)}</strong><div class="sm muted">${esc(s.artist)}</div></div><button class="ds-button-secondary btn-sm" data-act="linkManual" data-arg="${esc(s.id)}">Usar esta</button></li>`).join("") || `<li class="muted sm">Nenhuma música parecida.</li>`}</ul>` : "";
      return dialogShell(`“${esc(it.song.title)}” não está no Holyrics`,
        `<p class="sm muted">O app não cria músicas no Holyrics. Cadastre por um destes caminhos e depois leia a biblioteca de novo:</p>
         <ol class="instructions">
           <li><div><strong>Abrir o editor do Holyrics já com o nome.</strong> Você cola a letra e clica em Salvar lá.<div style="margin-top:.5rem"><button class="ds-button-secondary btn-sm" data-act="openEditor" data-autofocus>${icon("external")}Abrir no Holyrics</button></div>${g.editorOpened ? `<p class="sm" role="status" style="margin-top:.5rem">${icon("check")} Abrimos o editor no Holyrics com “${esc(it.song.title)}” preenchido.</p>` : ""}</div></li>
           <li><div><strong>Importar um arquivo</strong> (TXT, OpenLP ou OpenSong) se você tem a letra: no Holyrics, Arquivo → Importar.</div></li>
           <li><div><strong>Já está no Holyrics com outro nome?</strong> <button class="ds-link" data-act="openSearch">Procurar na biblioteca</button></div></li>
         </ol>${results}${status}`,
        `<button class="ds-button-secondary" data-act="closeDialog">Fechar</button><button class="ds-button" data-act="reread" ${g.reread === "reading" ? "disabled" : ""}>${g.reread === "reading" ? "Lendo…" : "Ler a biblioteca de novo"}</button>`);
    }
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
    const why = needPartial && !g.ackPartial ? "Marque para publicar sem essas músicas." : needDest && !g.ackDest ? "Confirme o destino para continuar." : "";
    return dialogShell(`Substituir a playlist de “${esc(d.destination.name)}”?`, `
      ${callout("warn", "alert", `As ${plural(before.length, "música de hoje sai", "músicas de hoje saem")} da playlist`, "Elas continuam na biblioteca do Holyrics; só saem deste culto. Guardamos uma cópia para voltar se der errado.")}
      <div class="diff-columns">
        <div class="diff-col before"><h3>Hoje no Holyrics (${before.length})</h3><ol>${before.map((s, i) => `<li><span class="n">${i + 1}</span><span class="t">${esc(s.title)}</span><span class="tag">sai</span></li>`).join("") || `<li class="muted">Playlist vazia</li>`}</ol></div>
        <div class="diff-col"><h3>Vai ficar (${after.length})</h3><ol>${after.map((s, i) => `<li><span class="n">${i + 1}</span><span><strong>${esc(s.song.title)}</strong><br><span class="xs subtle" style="font-weight:400">${esc(s.song.artist)}</span></span></li>`).join("")}</ol></div>
      </div>
      ${repeated.length ? `<p class="sm muted">${icon("repeat")} ${repeated.map((r) => `“${esc(r.song.title)}”`).join(", ")} aparece 1 vez (estava repetida no setlist).</p>` : ""}
      ${d.setlistSource === "cache" ? `<p class="sm muted">${icon("info")} Sem internet: usando o setlist baixado ${esc(fmtShort(d.setlistCachedAt))}. O aviso ao Videira será enviado depois.</p>` : ""}
      ${needPartial ? `<label class="check ds-card-muted" style="color:inherit"><input type="checkbox" data-change="ackPartial" ${g.ackPartial ? "checked" : ""}><span>Publicar mesmo sem: <strong>${out.map((o) => esc(o.song.title)).join(", ")}</strong><br><span class="sm muted">${out.length === 1 ? "Ela fica" : "Elas ficam"} fora da playlist até você resolver.</span></span></label>` : ""}
      ${needDest ? `<label class="check ds-card-muted" style="color:inherit"><input type="checkbox" data-change="ackDest" ${g.ackDest ? "checked" : ""}><span>Confirmo que <strong>${esc(d.destination.name)}</strong> é o destino certo</span></label>` : ""}`,
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
        <div class="ds-card-muted" style="color:inherit"><strong>Você vai precisar de:</strong><ul style="list-style:disc;padding-left:1.25rem;margin-top:.5rem"><li>Holyrics aberto neste computador</li><li>Alguém com acesso de administrador da igreja no Videira Music</li></ul></div>`;
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
        ${callout("info", "shield", "O Holyrics aceita conexões de outros aparelhos da rede", "O servidor do Holyrics fica disponível para a rede da igreja, sem criptografia. Este app só conversa com o próprio computador, mas outros aparelhos na mesma rede Wi-Fi poderiam usar o token. Use uma rede confiável (não a rede de visitantes) e não compartilhe o token.", `<button class="ds-link">Saiba como bloquear no firewall</button>`)}`;
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
        <h2>Atalhos</h2>
        <button data-act="go" data-arg="bandeja">Bandeja e notificações</button>
        <button data-act="fillTokens">Preencher tokens de exemplo (pareamento)</button>
        <p class="xs subtle" style="margin-top:.5rem;font-weight:400">Token Holyrics 0000000000000000 = recusado · 1111111111111111 = Holyrics fechado. Teclado: Ctrl+1…4 navega, Ctrl+R prepara de novo, Ctrl+Enter aciona o botão principal, Esc fecha diálogo.</p>
      </aside>` : ""}`;
  }

  // ---------------------------------------------------------------- ações
  const A = {
    go(arg) {
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
      if (wasSuspect) { S.data.destination = DEST_OK(); S.flash = { title: `Agora está selecionado: ${S.data.destination.name}.` }; }
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
    openMissing(arg) { S.dialog = { type: "missing", pos: arg, reread: null, tries: 0, search: null, editorOpened: false }; render(); },
    openEditor() { S.dialog.editorOpened = true; render(); },
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
      const g = S.dialog; g.reread = "reading"; render(); await sleep(900);
      const it = S.data.items.find((i) => i.position === Number(g.pos));
      if (g.tries >= 1 && it.simFoundOnReread) {
        it.state = "needsLink"; it.suggestion = { ...it.simFoundOnReread, reason: "exactTitleArtist" };
        S.dialog = null; S.flash = { tone: "info", icon: "link", title: `Encontramos “${it.song.title}”. Confirme o vínculo.` };
      } else { g.reread = "notFound"; g.tries++; }
      render();
    },
    toggleSel(arg, el) { S.review.sel[arg] = el.checked; render(); },
    async linkBatch() {
      const batch = S.data.items.filter((i) => i.state === "needsLink" && S.review.sel[i.songId] !== false);
      if (!batch.length) return;
      const snap = snapshot();
      S.linking = true; render(); await sleep(800); S.linking = false;
      batch.forEach((i) => { i.state = "ready"; i.holyrics = i.suggestion; i.matchedBy = "externalId"; S.sessionLinks.unshift({ title: i.song.title, artist: i.song.artist, holyricsId: i.suggestion.id, since: nowIso(), source: i.staleLink ? "reconciliation" : "batch" }); i.staleLink = null; });
      // itens repetidos que dependiam do mesmo vínculo continuam "repetida"
      S.flash = { title: `${plural(batch.length, "música vinculada", "músicas vinculadas")}.`, body: "Nas próximas semanas elas entram sozinhas.", undo: snap };
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
    if (k === "libSearch") { S.dialog.search = el.value; render(); const i = document.getElementById("lib-search"); i.focus(); i.setSelectionRange(i.value.length, i.value.length); return; }
    S.onb[k] = el.value; // sem re-render ao digitar
  });
  document.addEventListener("keydown", (ev) => {
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

  // Deep-link para revisão: index.html?cenario=pendencias&tela=review&dialogo=confirm
  const qs = new URLSearchParams(location.search);
  const startScenario = D.scenarios[qs.get("cenario")] ? qs.get("cenario") : "feliz";
  loadScenario(startScenario);
  if (qs.get("tela") && S.data.configured) S.screen = qs.get("tela");
  if (qs.get("onb")) S.onb.step = qs.get("onb");
  const dlg = qs.get("dialogo");
  if (dlg === "confirm") S.dialog = { type: "confirm", ackPartial: false, ackDest: false };
  if (dlg === "choose" || dlg === "missing") { const it = S.data.items.find((i) => i.state === (dlg === "choose" ? "chooseVersion" : "missing")); if (it) S.dialog = dlg === "choose" ? { type: "choose", pos: it.position, pick: null } : { type: "missing", pos: it.position, reread: null, tries: 0, search: null, editorOpened: false }; }
  if (qs.get("tema")) S.theme = qs.get("tema");
  render();
})();
