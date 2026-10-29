/*
 * Markdown seguro para a Ajuda. Aceita só um subconjunto: ## e ### títulos, parágrafos, listas (- e 1.),
 * tabelas, citação (>), **negrito**, `código` e links para outros tópicos ([texto](topico:id-do-topico), a mesma sintaxe validada por src/core/help).
 * Todo texto é escapado ANTES de virar HTML; nenhum HTML do .md passa. Links externos viram texto simples.
 */
(function () {
  "use strict";
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function inline(text, topicIds) {
    return text.split(/(`[^`]+`)/).map((part) => {
      if (/^`[^`]+`$/.test(part)) return `<code class="mono">${esc(part.slice(1, -1))}</code>`;
      let s = esc(part);
      s = s.replace(/\[([^\]]+)\]\(topico:([a-z0-9-]+)\)/g, (_, label, id) => topicIds.has(id)
        ? `<button class="ds-link" data-act="helpTopic" data-arg="${id}">${label}</button>` : label);
      s = s.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1"); // links externos: só o texto
      s = s.replace(/\*\*\(não testado\)\*\*/g, '<span class="status-chip status-chip--warn untested">não testado</span>');
      s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
      return s;
    }).join("");
  }

  function render(md, topicIds) {
    const lines = md.replace(/\r\n/g, "\n").split("\n");
    const out = [], toc = [];
    let i = 0, sec = 0;
    const isTableSep = (l) => /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/.test(l || "");
    const cells = (l) => l.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
    while (i < lines.length) {
      const l = lines[i];
      if (!l.trim()) { i++; continue; }
      let m;
      if ((m = l.match(/^(#{2,3})\s+(.*)$/))) {
        const level = m[1].length, id = `sec-${++sec}`;
        if (level === 2) toc.push({ id, title: m[2] });
        out.push(`<h${level + 1} id="${id}" tabindex="-1">${inline(m[2], topicIds)}</h${level + 1}>`);
        i++; continue;
      }
      if (l.startsWith("|") && isTableSep(lines[i + 1])) {
        const head = cells(l); i += 2;
        const rows = [];
        while (i < lines.length && lines[i].trim().startsWith("|")) rows.push(cells(lines[i++]));
        out.push(`<div class="md-table"><table><thead><tr>${head.map((h) => `<th scope="col">${inline(h, topicIds)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${inline(c, topicIds)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`);
        continue;
      }
      if (l.startsWith(">")) {
        const buf = [];
        while (i < lines.length && lines[i].startsWith(">")) buf.push(lines[i++].replace(/^>\s?/, ""));
        out.push(`<blockquote class="md-note"><p>${inline(buf.join(" "), topicIds)}</p></blockquote>`);
        continue;
      }
      if (/^(\s*)([-*]|\d+\.)\s+/.test(l)) {
        const ordered = /^\s*\d+\./.test(l), items = [];
        while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i]) && /^\s*\d+\./.test(lines[i]) === ordered) items.push(lines[i++].replace(/^\s*([-*]|\d+\.)\s+/, ""));
        out.push(`<${ordered ? "ol" : "ul"}>${items.map((t) => `<li>${inline(t, topicIds)}</li>`).join("")}</${ordered ? "ol" : "ul"}>`);
        continue;
      }
      const buf = [];
      while (i < lines.length && lines[i].trim() && !/^(#{2,3}\s|>|\||\s*([-*]|\d+\.)\s)/.test(lines[i])) buf.push(lines[i++]);
      if (!buf.length) { buf.push(lines[i++]); } // linha que não casou com nada: vira texto
      out.push(`<p>${inline(buf.join(" "), topicIds)}</p>`);
    }
    return { html: out.join("\n"), toc };
  }

  // Texto puro para a busca (sem marcação).
  const plain = (md) => md.replace(/[`*#>|]/g, " ").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/-{3,}/g, " ");
  const norm = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

  window.PROTO_HELP_MD = { render, plain, norm, esc };
})();
