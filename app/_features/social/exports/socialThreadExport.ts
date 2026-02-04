/* Social Thread HTML Export
   - Offline-friendly, step reveal, footer-safe autoscroll
   - Vocab pills + modal definitions
   - Checks tab + Teacher mode
   - TTS with voice picker + optional emoji speaking
*/

type AnyObj = Record<string, any>;

// Keep types loose enough to survive pack evolution without breaking builds.
export type ExportHtmlOptions = {
  defaultLens?: string;                 // "builder" | "debate" | etc
  defaultAutoVoices?: boolean;
  defaultSpeakEmojis?: boolean;
  defaultShowEmojis?: boolean;
  defaultPace?: "all" | "step" | string;
  initialVisibleCount?: number;
};

export type ExportOpts = {
  pack: AnyObj;                         // SocialThreadPack (kept flexible)
  filename?: string;

  // Offline helpers (optional)
  precomputeUnpacks?: boolean;
  precomputeLens?: string;
  precomputeLimitPerVariant?: number;

  htmlOptions?: ExportHtmlOptions;

  // Forward-compatible escape hatch
  [key: string]: any;
};

function safeFileName(name: string) {
  const base = String(name || "social-thread").trim() || "social-thread";
  return base
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

function jsonForInlineScript(obj: any) {
  // Prevent </script> breakouts and keep HTML safe-ish.
  return JSON.stringify(obj)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

function downloadTextFile(filename: string, content: string, mime = "text/html;charset=utf-8") {
  if (typeof window === "undefined") return;
  const blob = new Blob([content], { type: mime });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 0);
}

function normalizePackVariants(pack: AnyObj) {
  // Accept several shapes:
  // - pack.standard.messages / pack.supported.messages
  // - pack.variants[]
  // - pack.messages (single)
  const variants: { key: string; title: string; messages: any[]; checks?: any[] }[] = [];

  const add = (key: string, title: string, messages: any[], checks?: any[]) => {
    variants.push({
      key,
      title,
      messages: Array.isArray(messages) ? messages : [],
      checks: Array.isArray(checks) ? checks : [],
    });
  };

  if (Array.isArray(pack?.variants) && pack.variants.length) {
    for (const v of pack.variants) {
      add(
        String(v.key ?? v.id ?? v.name ?? "variant"),
        String(v.title ?? v.name ?? v.key ?? "Variant"),
        v.messages ?? v.thread ?? v.items ?? [],
        v.checks ?? v.questions ?? []
      );
    }
  } else {
    const std = pack?.standard ?? {};
    const sup = pack?.supported ?? pack?.adapted ?? {};
    const hasStd = Array.isArray(std?.messages);
    const hasSup = Array.isArray(sup?.messages);

    if (hasStd) add("standard", "Standard", std.messages, std.checks);
    if (hasSup) add("supported", "Supported", sup.messages, sup.checks);

    if (!variants.length) {
      add("thread", pack?.title ?? "Thread", pack?.messages ?? pack?.thread ?? [], pack?.checks ?? []);
    }
  }

  return variants;
}

export function buildSocialThreadHtml(opts: ExportOpts): string {
  const pack = opts?.pack ?? {};
  const title = String(pack.title ?? "Social Thread");
  const subtitle = String(pack.subtitle ?? "");
  const concepts = Array.isArray(pack.concepts) ? pack.concepts : [];
  const variants = normalizePackVariants(pack);

  const htmlOptions: ExportHtmlOptions = {
    defaultLens: "builder",
    defaultAutoVoices: true,
    defaultSpeakEmojis: false,
    defaultShowEmojis: true,
    defaultPace: "step",
    initialVisibleCount: 4,
    ...(opts?.htmlOptions ?? {}),
  };

  const SETTINGS = {
    ...htmlOptions,
    // Carry these through for debugging / future UI
    precomputeUnpacks: !!opts?.precomputeUnpacks,
    precomputeLens: opts?.precomputeLens ?? null,
    precomputeLimitPerVariant: opts?.precomputeLimitPerVariant ?? null,
  };

  const PACK_INLINE = jsonForInlineScript({
    ...pack,
    concepts,
    // keep original standard/supported too, but always provide variants array
    variants,
  });

  const SETTINGS_INLINE = jsonForInlineScript(SETTINGS);

  // NOTE: no template literal `${}` inside the HTML JS block besides our injected PACK/SETTINGS.
  // Keep this file robust against accidental interpolation changes.
  return [
'<!doctype html>',
'<html lang="en">',
'<head>',
'  <meta charset="utf-8" />',
'  <meta name="viewport" content="width=device-width, initial-scale=1" />',
`  <title>${escapeHtml(title)}</title>`,
'  <style>',
'    :root{',
'      color-scheme: light;',
'      --bg1:#f6f7fb;',
'      --bg2:#eef2ff;',
'      --card:#ffffff;',
'      --text:#172033;',
'      --muted:#5b6476;',
'      --border:#e6e8f0;',
'      --shadow: 0 10px 30px rgba(14,20,33,.08);',
'      --radius:16px;',
'      --dockH: 84px;',
'      --maxW: 1040px;',
'      --accent:#3b82f6;',
'    }',
'    html,body{height:100%;}',
'    body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:linear-gradient(180deg,var(--bg2),var(--bg1));color:var(--text);}',
'    .wrap{max-width:var(--maxW);margin:0 auto;padding:0 14px;}',
'    header{position:sticky;top:0;z-index:10;background:rgba(255,255,255,.88);backdrop-filter:saturate(1.2) blur(10px);border-bottom:1px solid var(--border);}',
'    .topbar{display:flex;gap:12px;align-items:flex-start;justify-content:space-between;padding:12px 0 10px;}',
'    h1{margin:0;font-size:16px;line-height:1.2;}',
'    .sub{margin-top:4px;color:var(--muted);font-size:12px;display:flex;gap:10px;flex-wrap:wrap;align-items:center;}',
'    .tabs{display:flex;gap:8px;align-items:center;margin-top:8px;flex-wrap:wrap;}',
'    .tab{font-size:12px;padding:6px 10px;border-radius:999px;border:1px solid var(--border);background:#fff;cursor:pointer;}',
'    .tab[aria-selected="true"]{border-color:rgba(59,130,246,.4);box-shadow:0 0 0 3px rgba(59,130,246,.12);}',
'    main{padding:14px 0 calc(var(--dockH) + 26px);}',
'    .grid{display:grid;grid-template-columns:1fr;gap:14px;}',
'    @media (min-width: 980px){.grid{grid-template-columns: 1.5fr .9fr;align-items:start;}}',
'    .panel{background:var(--card);border:1px solid var(--border);border-radius:var(--radius);box-shadow:var(--shadow);}',
'    .chat{padding:14px;display:flex;flex-direction:column;gap:10px;min-height:280px;}',
'    .msg{border:1px solid var(--border);border-radius:16px;background:#fff;padding:10px 12px;box-shadow:0 1px 0 rgba(0,0,0,.03);}',
'    .meta{display:flex;gap:10px;align-items:center;justify-content:space-between;}',
'    .who{display:flex;gap:10px;align-items:center;}',
'    .avatar{width:28px;height:28px;border-radius:999px;display:grid;place-items:center;font-weight:800;font-size:12px;color:#0b1220;}',
'    .name{font-weight:800;font-size:13px;}',
'    .idx{font-size:11px;color:var(--muted);}',
'    .text{margin-top:6px;white-space:pre-wrap;line-height:1.4;font-size:14px;}',
'    .row{margin-top:10px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;}',
'    .btn{font-size:12px;padding:7px 10px;border-radius:12px;border:1px solid var(--border);background:#fff;cursor:pointer;}',
'    .btn:hover{background:#f4f6ff;}',
'    .btn.primary{border-color:rgba(59,130,246,.45);background:rgba(59,130,246,.08);}',
'    .pill{font-size:11px;padding:4px 9px;border-radius:999px;border:1px solid var(--border);background:#fbfcff;color:#3a4356;cursor:pointer;}',
'    .pill:hover{background:#f2f4ff;}',
'    .side{padding:14px;}',
'    .side h2{margin:0 0 8px;font-size:13px;}',
'    .side .muted{color:var(--muted);font-size:12px;line-height:1.35;}',
'    .list{margin-top:10px;display:flex;flex-direction:column;gap:8px;}',
'    .item{border:1px solid var(--border);border-radius:14px;padding:10px 12px;background:#fff;}',
'    .term{font-weight:800;font-size:13px;}',
'    .def{margin-top:6px;color:#2b3343;font-size:13px;line-height:1.35;}',
'    .ex{margin-top:6px;color:var(--muted);font-size:12px;line-height:1.35;}',
'    .dock{position:fixed;left:0;right:0;bottom:0;z-index:20;background:rgba(255,255,255,.92);backdrop-filter:saturate(1.2) blur(10px);border-top:1px solid var(--border);}',
'    .dock .wrap{display:flex;gap:10px;align-items:center;justify-content:space-between;padding:10px 14px;}',
'    .controls{display:flex;gap:10px;flex-wrap:wrap;align-items:center;}',
'    select, label{font-size:12px;color:#1f2a44;}',
'    select{padding:6px 8px;border-radius:10px;border:1px solid var(--border);background:#fff;}',
'    .kpi{font-size:12px;color:var(--muted);display:flex;gap:10px;flex-wrap:wrap;align-items:center;}',
'    .toggle{display:flex;gap:6px;align-items:center;}',
'    .modalBG{position:fixed;inset:0;background:rgba(0,0,0,.35);display:none;align-items:center;justify-content:center;z-index:50;padding:18px;}',
'    .modal{max-width:760px;width:100%;background:#fff;border-radius:18px;border:1px solid var(--border);box-shadow:var(--shadow);padding:14px 14px 12px;}',
'    .modalHead{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;}',
'    .modalTitle{font-weight:900;font-size:14px;}',
'    .modalBody{margin-top:10px;font-size:13px;line-height:1.4;color:#273046;}',
'    .modalClose{border:1px solid var(--border);background:#fff;border-radius:12px;padding:7px 10px;cursor:pointer;font-size:12px;}',
'    .hidden{display:none!important;}',
'  </style>',
'</head>',
'<body>',
'  <header>',
'    <div class="wrap">',
'      <div class="topbar">',
'        <div>',
`          <h1>${escapeHtml(title)}</h1>`,
`          <div class="sub">${escapeHtml(subtitle)}</div>`,
'          <div class="tabs" role="tablist" aria-label="Views">',
'            <button class="tab" id="tabChat" aria-selected="true" type="button">Chat</button>',
'            <button class="tab" id="tabVocab" aria-selected="false" type="button">Vocab</button>',
'            <button class="tab" id="tabChecks" aria-selected="false" type="button">Checks</button>',
'          </div>',
'        </div>',
'        <div class="kpi">',
'          <span>Pace: <b id="paceLabel"></b></span>',
'          <span>Visible: <b id="visibleLabel"></b></span>',
'        </div>',
'      </div>',
'    </div>',
'  </header>',
'  <main class="wrap">',
'    <div class="grid">',
'      <section class="panel" id="chatPanel">',
'        <div class="chat" id="chat"></div>',
'      </section>',
'      <aside class="panel" id="sidePanel">',
'        <div class="side" id="sideChat">',
'          <h2>Thread tools</h2>',
'          <div class="muted">Tap a vocab pill to see a quick definition. Use Teacher mode to reveal answers in Checks.</div>',
'          <div class="muted" style="margin-top:8px;">Offline export — Unpack/Lens are available if you precompute them in the app.</div>',
'        </div>',
'        <div class="side hidden" id="sideVocab">',
'          <h2>Vocabulary</h2>',
'          <div class="muted">All concepts from this thread (tap to open).</div>',
'          <div class="list" id="vocabList"></div>',
'        </div>',
'        <div class="side hidden" id="sideChecks">',
'          <h2>Checks</h2>',
'          <div class="muted">Quick comprehension checks (Teacher mode shows answers).</div>',
'          <div class="list" id="checksList"></div>',
'        </div>',
'      </aside>',
'    </div>',
'  </main>',
'  <div class="dock">',
'    <div class="wrap">',
'      <div class="controls">',
'        <label>Variant:',
'          <select id="variantSel"></select>',
'        </label>',
'        <label>Pace:',
'          <select id="paceSel">',
'            <option value="step">Step</option>',
'            <option value="all">All</option>',
'          </select>',
'        </label>',
'        <button class="btn primary" id="btnNext" type="button">Next</button>',
'        <button class="btn" id="btnAll" type="button">Show all</button>',
'        <span class="toggle"><input id="chkTeacher" type="checkbox" /> <label for="chkTeacher">Teacher mode</label></span>',
'        <span class="toggle"><input id="chkShowEmojis" type="checkbox" /> <label for="chkShowEmojis">Show emojis</label></span>',
'        <span class="toggle"><input id="chkSpeakEmojis" type="checkbox" /> <label for="chkSpeakEmojis">Speak emojis</label></span>',
'      </div>',
'      <div class="controls">',
'        <label>Voice:',
'          <select id="voiceSel"></select>',
'        </label>',
'        <button class="btn" id="btnStop" type="button">Stop</button>',
'      </div>',
'    </div>',
'  </div>',
'  <div class="modalBG" id="modalBG" role="dialog" aria-modal="true">',
'    <div class="modal">',
'      <div class="modalHead">',
'        <div>',
'          <div class="modalTitle" id="modalTitle"></div>',
'        </div>',
'        <button class="modalClose" id="modalClose" type="button">Close</button>',
'      </div>',
'      <div class="modalBody" id="modalBody"></div>',
'    </div>',
'  </div>',
'  <script>',
`    const PACK = ${PACK_INLINE};`,
`    const SETTINGS = ${SETTINGS_INLINE};`,
'    const $ = (id) => document.getElementById(id);',
'    const chatEl = $("chat");',
'    const variantSel = $("variantSel");',
'    const paceSel = $("paceSel");',
'    const voiceSel = $("voiceSel");',
'    const chkTeacher = $("chkTeacher");',
'    const chkShowEmojis = $("chkShowEmojis");',
'    const chkSpeakEmojis = $("chkSpeakEmojis");',
'    const paceLabel = $("paceLabel");',
'    const visibleLabel = $("visibleLabel");',
'    const btnNext = $("btnNext");',
'    const btnAll = $("btnAll");',
'    const btnStop = $("btnStop");',
'    const tabChat = $("tabChat");',
'    const tabVocab = $("tabVocab");',
'    const tabChecks = $("tabChecks");',
'    const sideChat = $("sideChat");',
'    const sideVocab = $("sideVocab");',
'    const sideChecks = $("sideChecks");',
'    const vocabList = $("vocabList");',
'    const checksList = $("checksList");',
'    const modalBG = $("modalBG");',
'    const modalTitle = $("modalTitle");',
'    const modalBody = $("modalBody");',
'    const modalClose = $("modalClose");',
'',
'    const VARIANTS = Array.isArray(PACK.variants) ? PACK.variants : [];',
'    const CONCEPTS = Array.isArray(PACK.concepts) ? PACK.concepts : [];',
'    const conceptById = new Map();',
'    const conceptByTerm = new Map();',
'    CONCEPTS.forEach(c => {',
'      if (!c) return;',
'      const id = String(c.id ?? c.term ?? "").toLowerCase();',
'      const term = String(c.term ?? c.id ?? "").toLowerCase();',
'      if (id) conceptById.set(id, c);',
'      if (term) conceptByTerm.set(term, c);',
'    });',
'',
'    const state = {',
'      variantKey: (VARIANTS[0] && VARIANTS[0].key) || "standard",',
'      pace: (SETTINGS.defaultPace === "all" ? "all" : "step"),',
'      visible: Math.max(1, SETTINGS.initialVisibleCount || 4),',
'      showEmojis: !!SETTINGS.defaultShowEmojis,',
'      speakEmojis: !!SETTINGS.defaultSpeakEmojis,',
'      teacher: false,',
'      voiceURI: null,',
'      autoVoices: !!SETTINGS.defaultAutoVoices,',
'      view: "chat",',
'    };',
'',
'    function escapeHtml(s){',
'      return String(s ?? "")',
'        .replace(/&/g,"&amp;")',
'        .replace(/</g,"&lt;")',
'        .replace(/>/g,"&gt;")',
'        .replace(/"/g,"&quot;")',
'        .replace(/\\x27/g,"&#39;");',
'    }',
'',
'    function stripEmojis(s){',
'      try { return String(s||"").replace(/[\\p{Extended_Pictographic}]/gu,""); }',
'      catch { return String(s||""); }',
'    }',
'',
'    function hashStr(s){',
'      let h = 2166136261;',
'      const str = String(s||"");',
'      for (let i=0;i<str.length;i++){',
'        h ^= str.charCodeAt(i);',
'        h = Math.imul(h, 16777619);',
'      }',
'      return (h>>>0);',
'    }',
'',
'    const avatarPalette = [',
'      "#fde68a","#bfdbfe","#fecaca","#bbf7d0","#ddd6fe","#fed7aa","#bae6fd","#fbcfe8",',
'      "#e9d5ff","#c7d2fe","#a7f3d0","#fda4af"',
'    ];',
'',
'    function avatarFor(name){',
'      const h = hashStr(name);',
'      const bg = avatarPalette[h % avatarPalette.length];',
'      const initial = String(name||"?").trim().slice(0,1).toUpperCase() || "?";',
'      return { bg, initial };',
'    }',
'',
'    function getCurrentVariant(){',
'      return VARIANTS.find(v => v.key === state.variantKey) || VARIANTS[0] || { key:"thread", title:"Thread", messages:[], checks:[] };',
'    }',
'',
'    function getMsgText(m){',
'      const raw = String((m && (m.text ?? m.message ?? m.body ?? m.content ?? "")) ?? "");',
'      return state.showEmojis ? raw : stripEmojis(raw);',
'    }',
'',
'    function getMsgName(m){',
'      return String((m && (m.speaker ?? m.name ?? m.sender ?? m.author ?? m.user)) ?? "Participant");',
'    }',
'',
'    function getMsgTags(m){',
'      const t = (m && (m.tags ?? m.concepts ?? m.keywords)) ?? [];',
'      return Array.isArray(t) ? t.map(x => String(x)) : [];',
'    }',
'',
'    function openModal(title, bodyHtml){',
'      modalTitle.textContent = title;',
'      modalBody.innerHTML = bodyHtml;',
'      modalBG.style.display = "flex";',
'    }',
'',
'    function closeModal(){',
'      modalBG.style.display = "none";',
'      modalTitle.textContent = "";',
'      modalBody.innerHTML = "";',
'    }',
'',
'    modalClose.addEventListener("click", closeModal);',
'    modalBG.addEventListener("click", (e) => { if (e.target === modalBG) closeModal(); });',
'    window.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });',
'',
'    function conceptForTag(tag){',
'      const key = String(tag||"").toLowerCase();',
'      return conceptById.get(key) || conceptByTerm.get(key) || null;',
'    }',
'',
'    function renderVocab(){',
'      vocabList.innerHTML = "";',
'      CONCEPTS.forEach(c => {',
'        const term = String(c.term ?? c.id ?? "");',
'        const def = String(c.definition ?? "");',
'        const ex = String(c.example ?? "");',
'        const card = document.createElement("div");',
'        card.className = "item";',
'        card.innerHTML = `<div class="term">${escapeHtml(term)}</div>` +',
'          `<div class="def">${escapeHtml(def)}</div>` +',
'          (ex ? `<div class="ex">Example: ${escapeHtml(ex)}</div>` : "");',
'        card.addEventListener("click", () => {',
'          openModal(term, `<div><b>Definition:</b> ${escapeHtml(def)}</div>` + (ex?`<div style="margin-top:8px"><b>Example:</b> ${escapeHtml(ex)}</div>`:""));',
'        });',
'        vocabList.appendChild(card);',
'      });',
'      if (!CONCEPTS.length){',
'        const empty = document.createElement("div");',
'        empty.className = "muted";',
'        empty.textContent = "No concept list found in this export.";',
'        vocabList.appendChild(empty);',
'      }',
'    }',
'',
'    function renderChecks(){',
'      const v = getCurrentVariant();',
'      const checks = Array.isArray(v.checks) ? v.checks : [];',
'      checksList.innerHTML = "";',
'      checks.forEach((c, i) => {',
'        const prompt = String(c.prompt ?? c.q ?? c.question ?? "");',
'        const ans = String(c.answerKey ?? c.answer ?? c.a ?? "");',
'        const card = document.createElement("div");',
'        card.className = "item";',
'        card.innerHTML = `<div class="term">Q${i+1}. ${escapeHtml(prompt)}</div>` +',
'          (state.teacher && ans ? `<div class="def" style="margin-top:8px"><b>Answer:</b> ${escapeHtml(ans)}</div>` : "");',
'        checksList.appendChild(card);',
'      });',
'      if (!checks.length){',
'        const empty = document.createElement("div");',
'        empty.className = "muted";',
'        empty.textContent = "No checks found for this variant.";',
'        checksList.appendChild(empty);',
'      }',
'    }',
'',
'    function render(){',
'      const v = getCurrentVariant();',
'      const msgs = Array.isArray(v.messages) ? v.messages : [];',
'      const maxVisible = (state.pace === "all") ? msgs.length : state.visible;',
'      const slice = msgs.slice(0, Math.max(0, Math.min(maxVisible, msgs.length)));',
'',
'      paceLabel.textContent = state.pace;',
'      visibleLabel.textContent = String(slice.length) + " / " + String(msgs.length);',
'',
'      // enable/disable next button',
'      btnNext.disabled = (state.pace === "all") || (state.visible >= msgs.length);',
'',
'      chatEl.innerHTML = "";',
'      slice.forEach((m, idx) => {',
'        const name = getMsgName(m);',
'        const textRaw = getMsgText(m);',
'        const { bg, initial } = avatarFor(name);',
'        const tags = getMsgTags(m);',
'',
'        const msg = document.createElement("div");',
'        msg.className = "msg";',
'',
'        const pills = tags',
'          .map(t => ({ t, c: conceptForTag(t) }))',
'          .filter(x => !!x.c)',
'          .slice(0, 8);',
'',
'        msg.innerHTML = `',
'          <div class="meta">',
'            <div class="who">',
'              <div class="avatar" style="background:${bg}">${escapeHtml(initial)}</div>',
'              <div class="name">${escapeHtml(name)}</div>',
'            </div>',
'            <div class="idx">#${idx+1}</div>',
'          </div>',
'          <div class="text">${escapeHtml(textRaw)}</div>',
'          <div class="row">',
'            <button type="button" class="btn primary" data-speak="${idx}">Speak</button>',
'            <button type="button" class="btn" data-unpack="${idx}">Unpack</button>',
'            ${pills.map((p, j) => `<button type="button" class="pill" data-pill="${idx}|${j}">${escapeHtml(String(p.c.term ?? p.t))}</button>`).join("")}',
'          </div>',
'        `;',
'        chatEl.appendChild(msg);',
'      });',
'',
'      // wire buttons',
'      chatEl.querySelectorAll("[data-speak]").forEach(btn => {',
'        btn.addEventListener("click", () => {',
'          const i = Number(btn.getAttribute("data-speak") || "0");',
'          const m = (getCurrentVariant().messages || [])[i];',
'          speakMessage(m);',
'        });',
'      });',
'',
'      chatEl.querySelectorAll("[data-unpack]").forEach(btn => {',
'        btn.addEventListener("click", () => {',
'          const i = Number(btn.getAttribute("data-unpack") || "0");',
'          const m = (getCurrentVariant().messages || [])[i] || {};',
'          const unpack = m.unpack ?? m.unpacked ?? m.supports ?? null;',
'          if (unpack) {',
'            const body = Array.isArray(unpack)',
'              ? unpack.map(x => `<div style="margin-top:6px">• ${escapeHtml(String(x))}</div>`).join("")',
'              : `<div>${escapeHtml(String(unpack))}</div>`;',
'            openModal("Unpack", body);',
'          } else {',
'            openModal("Unpack", `<div class="muted">No unpack data in this offline export. (Enable <b>precomputeUnpacks</b> when exporting.)</div>`);',
'          }',
'        });',
'      });',
'',
'      chatEl.querySelectorAll("[data-pill]").forEach(btn => {',
'        btn.addEventListener("click", () => {',
'          const key = String(btn.getAttribute("data-pill") || "");',
'          const parts = key.split("|");',
'          const msgIdx = Number(parts[0] || "0");',
'          const pillIdx = Number(parts[1] || "0");',
'          const m = (getCurrentVariant().messages || [])[msgIdx] || {};',
'          const tags = getMsgTags(m);',
'          const pills = tags.map(t => ({ t, c: conceptForTag(t) })).filter(x => !!x.c).slice(0,8);',
'          const c = pills[pillIdx] ? pills[pillIdx].c : null;',
'          if (!c) return;',
'          const term = String(c.term ?? c.id ?? "");',
'          const def = String(c.definition ?? "");',
'          const ex = String(c.example ?? "");',
'          openModal(term, `<div><b>Definition:</b> ${escapeHtml(def)}</div>` + (ex?`<div style="margin-top:8px"><b>Example:</b> ${escapeHtml(ex)}</div>`:""));',
'        });',
'      });',
'',
'      renderChecks();',
'',
'      // footer-safe autoscroll to last visible message',
'      const last = chatEl.lastElementChild;',
'      if (last) {',
'        last.scrollIntoView({ behavior: "smooth", block: "end" });',
'      }',
'    }',
'',
'    // TTS',
'    function pickVoiceForSpeaker(speaker){',
'      const voices = window.speechSynthesis ? speechSynthesis.getVoices() : [];',
'      if (!voices.length) return null;',
'      if (!state.autoVoices) {',
'        const uri = state.voiceURI;',
'        return (uri && voices.find(v=>v.voiceURI===uri)) || voices[0];',
'      }',
'      // auto voices: hash speaker to voice list',
'      const idx = hashStr(speaker) % voices.length;',
'      return voices[idx];',
'    }',
'',
'    function speak(text, speaker){',
'      if (!window.speechSynthesis) return;',
'      try { speechSynthesis.cancel(); } catch {}',
'      const u = new SpeechSynthesisUtterance(String(text || ""));',
'      const v = pickVoiceForSpeaker(speaker || "");',
'      if (v) u.voice = v;',
'      u.rate = 0.95;',
'      u.pitch = 1;',
'      speechSynthesis.speak(u);',
'    }',
'',
'    function speakMessage(m){',
'      const name = getMsgName(m);',
'      let text = getMsgText(m);',
'      if (!state.speakEmojis) text = stripEmojis(text);',
'      speak(name + ". " + text, name);',
'    }',
'',
'    function fillVoices(){',
'      if (!window.speechSynthesis) {',
'        voiceSel.innerHTML = "<option value=\\"\\">No TTS available</option>";',
'        return;',
'      }',
'      const voices = speechSynthesis.getVoices();',
'      voiceSel.innerHTML = voices.map(v => `<option value="${escapeHtml(v.voiceURI)}">${escapeHtml(v.name)} (${escapeHtml(v.lang)})</option>`).join("");',
'      if (voices[0] && !state.voiceURI) state.voiceURI = voices[0].voiceURI;',
'      voiceSel.value = state.voiceURI || "";',
'    }',
'',
'    // Tabs',
'    function setView(view){',
'      state.view = view;',
'      tabChat.setAttribute("aria-selected", view==="chat" ? "true":"false");',
'      tabVocab.setAttribute("aria-selected", view==="vocab" ? "true":"false");',
'      tabChecks.setAttribute("aria-selected", view==="checks" ? "true":"false");',
'      sideChat.classList.toggle("hidden", view!=="chat");',
'      sideVocab.classList.toggle("hidden", view!=="vocab");',
'      sideChecks.classList.toggle("hidden", view!=="checks");',
'    }',
'    tabChat.addEventListener("click", () => setView("chat"));',
'    tabVocab.addEventListener("click", () => setView("vocab"));',
'    tabChecks.addEventListener("click", () => setView("checks"));',
'',
'    // Controls init',
'    variantSel.innerHTML = VARIANTS.map(v => `<option value="${escapeHtml(v.key)}">${escapeHtml(v.title ?? v.key)}</option>`).join("");',
'    variantSel.value = state.variantKey;',
'    paceSel.value = state.pace === "all" ? "all" : "step";',
'    chkShowEmojis.checked = state.showEmojis;',
'    chkSpeakEmojis.checked = state.speakEmojis;',
'',
'    variantSel.addEventListener("change", () => {',
'      state.variantKey = variantSel.value;',
'      state.visible = Math.max(1, SETTINGS.initialVisibleCount || 4);',
'      renderChecks();',
'      render();',
'    });',
'',
'    paceSel.addEventListener("change", () => {',
'      state.pace = paceSel.value === "all" ? "all" : "step";',
'      render();',
'    });',
'',
'    chkTeacher.addEventListener("change", () => {',
'      state.teacher = !!chkTeacher.checked;',
'      renderChecks();',
'      render();',
'    });',
'',
'    chkShowEmojis.addEventListener("change", () => {',
'      state.showEmojis = !!chkShowEmojis.checked;',
'      render();',
'    });',
'',
'    chkSpeakEmojis.addEventListener("change", () => {',
'      state.speakEmojis = !!chkSpeakEmojis.checked;',
'    });',
'',
'    btnNext.addEventListener("click", () => {',
'      const msgs = (getCurrentVariant().messages || []);',
'      state.visible = Math.min(msgs.length, state.visible + 1);',
'      render();',
'    });',
'',
'    btnAll.addEventListener("click", () => {',
'      const msgs = (getCurrentVariant().messages || []);',
'      state.visible = msgs.length;',
'      state.pace = "all";',
'      paceSel.value = "all";',
'      render();',
'    });',
'',
'    btnStop.addEventListener("click", () => {',
'      if (!window.speechSynthesis) return;',
'      try { speechSynthesis.cancel(); } catch {}',
'    });',
'',
'    voiceSel.addEventListener("change", () => {',
'      state.voiceURI = voiceSel.value || null;',
'      state.autoVoices = false;',
'    });',
'',
'    if (window.speechSynthesis) {',
'      speechSynthesis.onvoiceschanged = fillVoices;',
'      fillVoices();',
'    }',
'',
'    renderVocab();',
'    renderChecks();',
'    setView("chat");',
'    render();',
'  </script>',
'</body>',
'</html>',
  ].join("\\n");

  function escapeHtml(s: string) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
}

export async function exportSocialThreadHtml(opts: ExportOpts): Promise<string> {
  const html = buildSocialThreadHtml(opts);
  const title = String(opts?.pack?.title ?? "Social Thread");
  const filename = safeFileName(opts?.filename || title) + ".html";
  downloadTextFile(filename, html, "text/html;charset=utf-8");
  return html;
}
