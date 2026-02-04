/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Social Thread HTML export (standalone file).
 * Goal: keep typings stable and avoid TS build failures when UI/export options evolve.
 * This file intentionally stays dependency-light and works in both browser + server contexts.
 */

export type ExportHtmlOptions = {
  // Defaults for exported Social Thread HTML
  defaultLens?: string;                 // e.g. "builder" | "debate" (viewer may ignore)
  defaultAutoVoices?: boolean;
  defaultSpeakEmojis?: boolean;
  defaultShowEmojis?: boolean;
  defaultPace?: "all" | "step" | string;
  initialVisibleCount?: number;

  // Forward-compatible: allow extra options without breaking builds
  [key: string]: any;
};

export type ExportOpts = {
  pack: any; // SocialThreadPack (kept as any to avoid brittle imports)

  fileBaseName?: string;                // filename without extension
  precomputeUnpacks?: boolean;          // reserved for richer offline exports
  precomputeLens?: string;              // reserved
  precomputeLimitPerVariant?: number;   // reserved

  htmlOptions?: ExportHtmlOptions;

  // If true, returns { html, filename } instead of downloading (useful for server/API routes)
  returnHtml?: boolean;

  // Forward-compatible: allow extra options without breaking builds
  [key: string]: any;
};

export type ExportResult = { html: string; filename: string };

function safeFileBaseName(s: string) {
  const base = (s || "social-thread")
    .trim()
    .replace(/[^\w\-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return base || "social-thread";
}

function escapeHtml(s: any) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Try to extract variants + messages from a variety of pack shapes.
// We keep this permissive so it works across old/new pack schemas.
function extractVariants(pack: any): { key: string; title: string; messages: any[] }[] {
  if (!pack) return [{ key: "default", title: "Thread", messages: [] }];

  // 1) pack.variants = { standard: {...}, supported: {...}, ... }
  if (pack.variants && typeof pack.variants === "object") {
    const entries = Object.entries(pack.variants);
    if (entries.length) {
      return entries.map(([k, v]: any) => ({
        key: String(k),
        title: String((v && (v.title || v.name)) || k),
        messages: (v && (v.messages || v.thread || v.items)) || [],
      }));
    }
  }

  // 2) common top-level keys
  const candidates = ["standard", "supported", "adapted", "student", "teacher"];
  const found = candidates.filter((k) => pack[k] && typeof pack[k] === "object");
  if (found.length) {
    return found.map((k) => {
      const v = pack[k];
      return {
        key: k,
        title: String(v.title || v.name || k),
        messages: v.messages || v.thread || v.items || [],
      };
    });
  }

  // 3) single thread: pack.messages
  if (Array.isArray(pack.messages)) {
    return [{ key: "default", title: String(pack.title || "Thread"), messages: pack.messages }];
  }

  // fallback
  return [{ key: "default", title: String(pack.title || "Thread"), messages: [] }];
}

function guessTitle(pack: any) {
  return String(pack?.title || pack?.name || "Social Thread");
}

function buildHtml(pack: any, opts: ExportHtmlOptions): string {
  const title = guessTitle(pack);
  const variants = extractVariants(pack);

  const settings = {
    defaultLens: opts.defaultLens ?? "builder",
    defaultAutoVoices: !!opts.defaultAutoVoices,
    defaultSpeakEmojis: opts.defaultSpeakEmojis ?? false,
    defaultShowEmojis: opts.defaultShowEmojis ?? true,
    defaultPace: opts.defaultPace ?? "step",
    initialVisibleCount: Number.isFinite(opts.initialVisibleCount) ? opts.initialVisibleCount : 4,
  };

  // Embed pack safely for offline viewing
  const packJson = JSON.stringify(pack ?? {}, null, 0);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root { color-scheme: light; }
    body { margin: 0; font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; background: #f6f7fb; }
    header { position: sticky; top: 0; background: white; border-bottom: 1px solid #e6e8f0; padding: 12px 14px; z-index: 5; }
    h1 { margin: 0; font-size: 16px; }
    .sub { margin-top: 4px; color: #556; font-size: 12px; display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
    .wrap { max-width: 980px; margin: 0 auto; }
    .panel { padding: 12px 14px; }
    .controls { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
    select, button, label { font-size: 13px; }
    button { padding: 8px 10px; border-radius: 10px; border: 1px solid #d7dbea; background: white; cursor: pointer; }
    button:hover { background: #f2f4ff; }
    .chat { display: flex; flex-direction: column; gap: 10px; padding: 14px; }
    .msg { background: white; border: 1px solid #e6e8f0; border-radius: 14px; padding: 10px 12px; box-shadow: 0 1px 0 rgba(0,0,0,0.02); }
    .meta { display: flex; gap: 8px; align-items: baseline; }
    .name { font-weight: 700; font-size: 13px; }
    .tag { font-size: 11px; color: #667; }
    .text { margin-top: 6px; white-space: pre-wrap; line-height: 1.35; }
    .row { margin-top: 8px; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    .pill { font-size: 11px; padding: 4px 8px; border-radius: 999px; border: 1px solid #d7dbea; background: #fbfcff; color: #445; }
    .footer { height: 18px; }
    .warn { background:#fff7e6; border:1px solid #ffd59a; padding:8px 10px; border-radius:10px; font-size:12px; color:#643; }
    .tiny { font-size: 11px; color: #667; }
  </style>
</head>
<body>
  <header>
    <div class="wrap">
      <h1>${escapeHtml(title)}</h1>
      <div class="sub">
        <span class="tiny">Offline Social Thread export</span>
        <span class="tiny">Pace: <b id="paceLabel"></b></span>
        <span class="tiny">Visible: <b id="visibleLabel"></b></span>
      </div>
      <div class="panel controls">
        <label>Variant:
          <select id="variantSel"></select>
        </label>

        <label>Pace:
          <select id="paceSel">
            <option value="step">Step</option>
            <option value="all">All</option>
          </select>
        </label>

        <button id="btnNext" type="button">Next</button>
        <button id="btnAll" type="button">Show all</button>

        <label><input id="chkShowEmojis" type="checkbox" /> Show emojis</label>
        <label><input id="chkSpeakEmojis" type="checkbox" /> Speak emojis</label>

        <label>Voice:
          <select id="voiceSel"></select>
        </label>
        <button id="btnStop" type="button">Stop voice</button>
      </div>
      <div class="panel warn">
        Note: this is a lightweight offline viewer. “Unpack / Lens” features may be limited unless you enable precompute in the app.
      </div>
    </div>
  </header>

  <main class="wrap">
    <div id="chat" class="chat"></div>
    <div class="footer"></div>
  </main>

<script>
  const PACK = ${packJson};
  const SETTINGS = ${JSON.stringify(settings)};
  const VARIANTS = ${JSON.stringify(variants)};

  const $ = (id) => document.getElementById(id);
  const chatEl = $("chat");
  const variantSel = $("variantSel");
  const paceSel = $("paceSel");
  const voiceSel = $("voiceSel");
  const chkShowEmojis = $("chkShowEmojis");
  const chkSpeakEmojis = $("chkSpeakEmojis");
  const paceLabel = $("paceLabel");
  const visibleLabel = $("visibleLabel");
  const btnNext = $("btnNext");
  const btnAll = $("btnAll");
  const btnStop = $("btnStop");

  const state = {
    variantKey: (VARIANTS[0] && VARIANTS[0].key) || "default",
    pace: SETTINGS.defaultPace === "all" ? "all" : "step",
    visible: Math.max(1, SETTINGS.initialVisibleCount || 4),
    showEmojis: !!SETTINGS.defaultShowEmojis,
    speakEmojis: !!SETTINGS.defaultSpeakEmojis,
    voiceURI: null
  };

  function stripEmojis(s) {
    try {
      // broad emoji-ish range; not perfect, but good enough
      return String(s||"").replace(/[\\p{Extended_Pictographic}]/gu, "");
    } catch {
      return String(s||"");
    }
  }

  function getCurrentVariant() {
    return VARIANTS.find(v => v.key === state.variantKey) || VARIANTS[0] || { key:"default", title:"Thread", messages: [] };
  }

  function getMsgText(m) {
    const raw = (m && (m.text ?? m.message ?? m.body ?? m.content ?? "")) + "";
    return state.showEmojis ? raw : stripEmojis(raw);
  }

  function getMsgName(m) {
    return (m && (m.name || m.sender || m.author || m.user || "Participant")) + "";
  }

  function render() {
    const v = getCurrentVariant();
    const msgs = Array.isArray(v.messages) ? v.messages : [];
    const maxVisible = state.pace === "all" ? msgs.length : state.visible;
    const slice = msgs.slice(0, Math.max(0, Math.min(maxVisible, msgs.length)));

    paceLabel.textContent = state.pace;
    visibleLabel.textContent = String(slice.length) + " / " + String(msgs.length);

    chatEl.innerHTML = "";
    slice.forEach((m, idx) => {
      const name = getMsgName(m);
      const text = getMsgText(m);

      const card = document.createElement("div");
      card.className = "msg";
      card.innerHTML = \`
        <div class="meta">
          <div class="name">\${escapeHtml(name)}</div>
          <div class="tag">#\${idx+1}</div>
        </div>
        <div class="text">\${escapeHtml(text)}</div>
        <div class="row">
          <button type="button" data-speak="\${idx}" class="pill">Speak</button>
        </div>
      \`;
      chatEl.appendChild(card);
    });

    // Wire speak buttons
    chatEl.querySelectorAll("[data-speak]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const i = Number(btn.getAttribute("data-speak") || "0");
        const v = getCurrentVariant();
        const msgs = Array.isArray(v.messages) ? v.messages : [];
        const m = msgs[i];
        speakMessage(m);
      });
    });
  }

  // --- TTS
  function pickVoice() {
    const uri = state.voiceURI;
    const voices = window.speechSynthesis ? speechSynthesis.getVoices() : [];
    if (!voices.length) return null;
    if (uri) return voices.find(v => v.voiceURI === uri) || voices[0];
    return voices[0];
  }

  function speak(text) {
    if (!window.speechSynthesis) return;
    try { speechSynthesis.cancel(); } catch {}
    const u = new SpeechSynthesisUtterance(String(text || ""));
    const v = pickVoice();
    if (v) u.voice = v;
    u.rate = 0.95;
    u.pitch = 1;
    speechSynthesis.speak(u);
  }

  function speakMessage(m) {
    const name = getMsgName(m);
    let text = getMsgText(m);
    if (!state.speakEmojis) text = stripEmojis(text);

    // speak name + message (simple)
    speak(name + ". " + text);
  }

  function fillVoices() {
    if (!window.speechSynthesis) {
      voiceSel.innerHTML = "<option value=''>No TTS available</option>";
      return;
    }
    const voices = speechSynthesis.getVoices();
    voiceSel.innerHTML = voices.map(v => \`<option value="\${escapeHtml(v.voiceURI)}">\${escapeHtml(v.name)} (\${escapeHtml(v.lang)})</option>\`).join("");
    if (voices[0] && !state.voiceURI) state.voiceURI = voices[0].voiceURI;
    voiceSel.value = state.voiceURI || "";
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // Init controls
  variantSel.innerHTML = VARIANTS.map(v => \`<option value="\${escapeHtml(v.key)}">\${escapeHtml(v.title)}</option>\`).join("");
  variantSel.value = state.variantKey;

  paceSel.value = state.pace;
  chkShowEmojis.checked = state.showEmojis;
  chkSpeakEmojis.checked = state.speakEmojis;

  variantSel.addEventListener("change", () => {
    state.variantKey = variantSel.value;
    state.visible = Math.max(1, SETTINGS.initialVisibleCount || 4);
    render();
  });

  paceSel.addEventListener("change", () => {
    state.pace = paceSel.value === "all" ? "all" : "step";
    render();
  });

  chkShowEmojis.addEventListener("change", () => {
    state.showEmojis = !!chkShowEmojis.checked;
    render();
  });

  chkSpeakEmojis.addEventListener("change", () => {
    state.speakEmojis = !!chkSpeakEmojis.checked;
  });

  btnNext.addEventListener("click", () => {
    const v = getCurrentVariant();
    const msgs = Array.isArray(v.messages) ? v.messages : [];
    state.visible = Math.min(msgs.length, state.visible + 1);
    render();
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
  });

  btnAll.addEventListener("click", () => {
    const v = getCurrentVariant();
    const msgs = Array.isArray(v.messages) ? v.messages : [];
    state.visible = msgs.length;
    state.pace = "all";
    paceSel.value = "all";
    render();
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
  });

  btnStop.addEventListener("click", () => {
    if (!window.speechSynthesis) return;
    try { speechSynthesis.cancel(); } catch {}
  });

  voiceSel.addEventListener("change", () => {
    state.voiceURI = voiceSel.value || null;
  });

  if (window.speechSynthesis) {
    speechSynthesis.onvoiceschanged = fillVoices;
    fillVoices();
  }

  render();
</script>
</body>
</html>`;
}

export async function exportSocialThreadHtml(opts: ExportOpts & { returnHtml: true }): Promise<ExportResult>;
export async function exportSocialThreadHtml(opts: ExportOpts & { returnHtml?: false }): Promise<void>;
export async function exportSocialThreadHtml(opts: ExportOpts): Promise<any> {
  const pack = opts?.pack ?? {};
  const htmlOptions: ExportHtmlOptions = opts?.htmlOptions ?? {};
  const html = buildHtml(pack, htmlOptions);

  const base = safeFileBaseName(opts?.fileBaseName || guessTitle(pack));
  const filename = base.endsWith(".html") ? base : `${base}.html`;

  // Server context: only return if requested
  const isBrowser = typeof window !== "undefined" && typeof document !== "undefined";

  if (opts?.returnHtml || !isBrowser) {
    return { html, filename } satisfies ExportResult;
  }

  // Browser context: download as a file
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
