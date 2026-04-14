"use client";

/**
 * Full Social Thread HTML Export (offline-friendly)
 * - Standard + Supported mapping (supports "adapted" alias)
 * - Default: 1 comment visible
 * - Active message highlighted
 * - Next scrolls so active is clearly visible (dock-aware)
 * - Karaoke mode (best-effort: uses onboundary when supported)
 * - Mystery words (click to reveal)
 */

export type ExportHtmlOptions = {
  defaultLens?: string;
  defaultAutoVoices?: boolean;
  defaultSpeakEmojis?: boolean;
  defaultShowEmojis?: boolean;
  defaultPace?: "all" | "step" | string;
  initialVisibleCount?: number; // default 1
  defaultKaraoke?: boolean;
  defaultMysteryWordsPerMsg?: number;
};

export type ExportOpts = {
  pack: any;
  filename?: string;
  precomputeUnpacks?: boolean;
  precomputeLens?: string;
  precomputeLimitPerVariant?: number;
  htmlOptions?: ExportHtmlOptions;
  [key: string]: any;
};

function safeFileBase(s: string) {
  return String(s || "social-thread")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 90) || "social-thread";
}

function downloadHtml(filename: string, html: string) {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function esc(s: string) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export async function exportSocialThreadHtml(opts: ExportOpts): Promise<void> {
  const pack = opts?.pack ?? {};
  const title = String(pack?.title ?? pack?.topic ?? "Social Thread");

  const opt: ExportHtmlOptions = {
    defaultLens: "builder",
    defaultAutoVoices: true,
    defaultSpeakEmojis: false,
    defaultShowEmojis: true,
    defaultPace: "step",
    initialVisibleCount: 1,
    defaultKaraoke: false,
    defaultMysteryWordsPerMsg: 0,
    ...(opts?.htmlOptions ?? {}),
  };

  const fileBase = safeFileBase(opts?.filename || title);
  const filename = `${fileBase}.html`;

  const packJson = JSON.stringify(pack).replace(/</g, "\\u003c").replace(/>/g, "\\u003e");

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${esc(title)}</title>
<style>
  :root{
    --bg:#f5f7fb; --card:#fff; --ink:#0f172a; --muted:#475569; --line:#e2e8f0;
    --shadow: 0 12px 40px rgba(15,23,42,.10);
    --dockH: 96px; --r:18px;
  }
  *{box-sizing:border-box}
  body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;background:var(--bg);color:var(--ink);}
  .wrap{max-width:1200px;margin:18px auto calc(var(--dockH) + 28px);padding:0 16px;}
  header{display:flex;justify-content:space-between;gap:14px;align-items:flex-end;margin:8px 0 14px;}
  h1{margin:0;font-size:18px;}
  .sub{color:var(--muted);font-size:12px;}
  .grid{display:grid;grid-template-columns:1.2fr .8fr;gap:14px;}
  @media(max-width:980px){.grid{grid-template-columns:1fr}}
  .panel{background:var(--card);border:1px solid var(--line);border-radius:var(--r);box-shadow:var(--shadow);overflow:hidden;}
  .head{padding:12px 14px;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;gap:10px;align-items:center;}
  .title{font-weight:900;font-size:13px;}
  .list{padding:12px;}
  .msg{border:1px solid var(--line);border-radius:16px;padding:12px;background:#fff;margin-bottom:10px;scroll-margin-bottom:calc(var(--dockH) + 18px);}
  .msg.active{border-color:rgba(37,99,235,.55);outline:3px solid rgba(37,99,235,.12);box-shadow:0 10px 28px rgba(37,99,235,.12);}
  .row{display:flex;gap:10px;align-items:flex-start}
  .avatar{width:34px;height:34px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-weight:900;background:#eef2ff;color:#1e293b;flex:0 0 auto;}
  .meta{display:flex;justify-content:space-between;gap:10px;align-items:center;}
  .name{font-weight:900;font-size:13px;}
  .idx{color:var(--muted);font-size:12px;}
  .text{margin-top:6px;line-height:1.45;font-size:15px;word-break:break-word;}
  .btnRow{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;}
  .btn{border:1px solid var(--line);background:#fff;border-radius:999px;padding:7px 11px;font-weight:900;font-size:12px;cursor:pointer;}
  .btn.primary{background:rgba(37,99,235,.08);border-color:rgba(37,99,235,.25);}
  .dock{position:fixed;left:0;right:0;bottom:0;background:rgba(245,247,251,.92);backdrop-filter:blur(10px);border-top:1px solid var(--line);padding:10px 12px;z-index:9999;}
  .dockInner{max-width:1200px;margin:0 auto;display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:center;}
  .controls{display:flex;gap:10px;align-items:center;flex-wrap:wrap;}
  label{font-size:12px;color:var(--muted);font-weight:900;display:flex;gap:6px;align-items:center;}
  select{border:1px solid var(--line);border-radius:10px;padding:6px 8px;background:#fff;font-weight:900;font-size:12px;}
  .dockBtn{border:1px solid var(--line);background:#fff;border-radius:12px;padding:8px 10px;font-weight:900;font-size:12px;cursor:pointer;}
  .dockBtn.primary{background:rgba(124,58,237,.10);border-color:rgba(124,58,237,.30);}
  .dockBtn:disabled{opacity:.45;cursor:not-allowed;}
  /* karaoke + mystery */
  .w{padding:0 1px;border-radius:6px}
  .w.on{background:rgba(124,58,237,.18)}
  .mw{padding:0 3px;border-radius:8px;background:rgba(37,99,235,.10);border:1px dashed rgba(37,99,235,.35);cursor:pointer;user-select:none}
  .mw.revealed{background:transparent;border:1px solid transparent;cursor:default}
  .concept{border-top:1px solid var(--line);padding:12px 14px}
  .term{font-weight:900;font-size:13px;margin-bottom:4px}
  .def{color:var(--muted);font-size:13px;line-height:1.4}
</style>
</head>
<body>
<div class="wrap">
  <header>
    <div>
      <h1>${esc(title)}</h1>
      <div class="sub">Offline Social Thread export • step, highlight, karaoke, mystery words</div>
    </div>
    <div class="sub" id="status"></div>
  </header>

  <div class="grid">
    <div class="panel">
      <div class="head"><div class="title">Thread</div><div class="sub" id="threadMeta"></div></div>
      <div class="list" id="thread"></div>
    </div>

    <div class="panel">
      <div class="head"><div class="title">Concepts</div><div class="sub" id="conceptMeta"></div></div>
      <div id="concepts"></div>
    </div>
  </div>
</div>

<div class="dock" id="dock">
  <div class="dockInner">
    <div class="controls">
      <label>Variant:
        <select id="variantSel"></select>
      </label>

      <label>Pace:
        <select id="paceSel">
          <option value="step">Step</option>
          <option value="all">All</option>
        </select>
      </label>

      <button class="dockBtn primary" id="btnNext">Next</button>
      <button class="dockBtn" id="btnAll">Show all</button>

      <label><input type="checkbox" id="chkEmojis"/> Show emojis</label>
      <label><input type="checkbox" id="chkSpeakEmojis"/> Speak emojis</label>
      <label><input type="checkbox" id="chkKaraoke"/> Karaoke</label>

      <label>Mystery:
        <select id="mysterySel">
          <option value="0">Off</option>
          <option value="2">2</option>
          <option value="4">4</option>
          <option value="6">6</option>
        </select>
      </label>
    </div>

    <div class="controls">
      <label>Voice:
        <select id="voiceSel"></select>
      </label>
      <button class="dockBtn" id="btnStop">Stop</button>
    </div>
  </div>
</div>

<script id="__PACK__" type="application/json">${esc(packJson)}</script>
<script>
(function(){
  const pack = JSON.parse(document.getElementById("__PACK__").textContent || "{}");
  const opt = ${esc(JSON.stringify(opt))};

  const els = {
    thread: document.getElementById("thread"),
    concepts: document.getElementById("concepts"),
    status: document.getElementById("status"),
    threadMeta: document.getElementById("threadMeta"),
    conceptMeta: document.getElementById("conceptMeta"),
    dock: document.getElementById("dock"),
    variantSel: document.getElementById("variantSel"),
    paceSel: document.getElementById("paceSel"),
    btnNext: document.getElementById("btnNext"),
    btnAll: document.getElementById("btnAll"),
    chkEmojis: document.getElementById("chkEmojis"),
    chkSpeakEmojis: document.getElementById("chkSpeakEmojis"),
    chkKaraoke: document.getElementById("chkKaraoke"),
    mysterySel: document.getElementById("mysterySel"),
    voiceSel: document.getElementById("voiceSel"),
    btnStop: document.getElementById("btnStop"),
  };

  // ----- Variants mapping (standard/supported; allow adapted alias)
  function hasObj(x){ return x && typeof x === "object"; }
  function buildVariants(){
    const arr = [];
    if (hasObj(pack.standard)) arr.push({ key:"standard", title:"Standard", data: pack.standard });
    if (hasObj(pack.supported)) arr.push({ key:"supported", title:"Supported", data: pack.supported });
    else if (hasObj(pack.adapted)) arr.push({ key:"supported", title:"Supported", data: pack.adapted });
    if (!arr.length) arr.push({ key:"thread", title:"Thread", data: pack });
    return arr;
  }
  const VARS = buildVariants();

  els.variantSel.innerHTML = VARS.map(v => '<option value="'+v.key+'">'+v.title+'</option>').join("");
  els.variantSel.value = VARS[0].key;

  // defaults
  els.paceSel.value = (opt.defaultPace === "all") ? "all" : "step";
  els.chkEmojis.checked = !!opt.defaultShowEmojis;
  els.chkSpeakEmojis.checked = !!opt.defaultSpeakEmojis;
  els.chkKaraoke.checked = !!opt.defaultKaraoke;
  els.mysterySel.value = String(opt.defaultMysteryWordsPerMsg || 0);

  let visibleCount = Math.max(1, Number(opt.initialVisibleCount || 1));
  let activeIdx = 0;

  // concepts (inline; no missing helper)
  const concepts = (pack && (pack.concepts || pack.vocab || pack.glossary)) || [];

  // speech
  let voices = [];
  function loadVoices(){
    voices = window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
    els.voiceSel.innerHTML = "";
    voices.forEach((v,i) => {
      const o = document.createElement("option");
      o.value = String(i);
      o.textContent = v.name + " (" + v.lang + ")";
      els.voiceSel.appendChild(o);
    });
    const idx = voices.findIndex(v => /en/i.test(v.lang));
    if (idx >= 0) els.voiceSel.value = String(idx);
  }
  if (window.speechSynthesis){
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }

  function stopSpeak(){
    try{ if (window.speechSynthesis) window.speechSynthesis.cancel(); }catch(e){}
    document.querySelectorAll(".w.on").forEach(el => el.classList.remove("on"));
  }

  function stripEmojiSpeech(s){
    try { return String(s||"").replace(/[\p{Extended_Pictographic}]/gu,""); }
    catch(e){ return String(s||""); }
  }

  function speak(text, msgEl){
    stopSpeak();
    if (!window.speechSynthesis) return;

    const karaoke = !!els.chkKaraoke.checked;
    const speakEmojis = !!els.chkSpeakEmojis.checked;
    const spoken = speakEmojis ? String(text||"") : stripEmojiSpeech(text||"");

    const utt = new SpeechSynthesisUtterance(spoken);
    const vIdx = parseInt(els.voiceSel.value || "0", 10);
    if (voices[vIdx]) utt.voice = voices[vIdx];
    utt.rate = 0.95; utt.pitch = 1.0;

    if (karaoke && msgEl){
      prepareKaraoke(msgEl, spoken);
      utt.onboundary = function(ev){
        if (ev && typeof ev.charIndex === "number"){
          karaokeAtChar(msgEl, ev.charIndex);
        }
      };
      utt.onend = function(){ document.querySelectorAll(".w.on").forEach(el => el.classList.remove("on")); };
      utt.onerror = function(){ document.querySelectorAll(".w.on").forEach(el => el.classList.remove("on")); };
    }

    window.speechSynthesis.speak(utt);
  }

  function prepareKaraoke(msgEl, spokenText){
    const textEl = msgEl.querySelector(".text");
    if (!textEl) return;
    const src = spokenText;
    const parts = [];
    let i = 0;
    while (i < src.length){
      if (/\s/.test(src[i])) { parts.push({t:src[i], start:i, w:false}); i++; continue; }
      const m = src.slice(i).match(/^[\p{L}\p{M}\p{N}']+/u);
      if (m){ parts.push({t:m[0], start:i, w:true}); i += m[0].length; continue; }
      parts.push({t:src[i], start:i, w:false}); i++;
    }
    textEl.innerHTML = "";
    for (const p of parts){
      if (!p.w){ textEl.appendChild(document.createTextNode(p.t)); }
      else{
        const sp = document.createElement("span");
        sp.className = "w";
        sp.textContent = p.t;
        sp.setAttribute("data-start", String(p.start));
        textEl.appendChild(sp);
      }
    }
  }

  function karaokeAtChar(msgEl, charIndex){
    const spans = msgEl.querySelectorAll(".w");
    let best = null;
    for (let i=0;i<spans.length;i++){
      const st = parseInt(spans[i].getAttribute("data-start") || "0", 10);
      if (st <= charIndex) best = spans[i]; else break;
    }
    spans.forEach(x => x.classList.remove("on"));
    if (best) best.classList.add("on");
  }

  function seededRand(seed){
    let x = seed >>> 0;
    return function(){ x = (1664525 * x + 1013904223) >>> 0; return x / 4294967296; };
  }

  function applyMystery(rawText, msgIndex, count){
    if (!count || count<=0) return { html: esc(rawText), did:false };
    const words = [];
    const re = /[\p{L}\p{M}\p{N}']+/gu;
    let m;
    while ((m = re.exec(rawText)) !== null){
      const w = m[0];
      if (w.length >= 5) words.push({ w, i: m.index, len: w.length });
    }
    if (!words.length) return { html: esc(rawText), did:false };

    const r = seededRand((msgIndex+1)*1337 + rawText.length*17);
    const chosen = new Set();
    const maxPick = Math.min(count, words.length);
    while (chosen.size < maxPick) chosen.add(Math.floor(r()*words.length));
    const chosenArr = Array.from(chosen).map(i => words[i]).sort((a,b)=>a.i-b.i);

    let out = "";
    let cur = 0;
    for (const it of chosenArr){
      out += esc(rawText.slice(cur, it.i));
      const real = rawText.substr(it.i, it.len);
      const masked = "▯".repeat(Math.min(8, Math.max(4, real.length)));
      out += '<span class="mw" data-real="'+esc(real)+'">'+masked+'</span>';
      cur = it.i + it.len;
    }
    out += esc(rawText.slice(cur));
    return { html: out, did:true };
  }

  function wireMystery(root){
    root.querySelectorAll(".mw").forEach(el => {
      el.addEventListener("click", () => {
        if (el.classList.contains("revealed")) return;
        el.textContent = el.getAttribute("data-real") || "";
        el.classList.add("revealed");
      });
    });
  }

  function getDockH(){
    const r = els.dock.getBoundingClientRect();
    return r.height || 96;
  }

  function scrollToActive(){
    const el = document.querySelector(".msg.active");
    if (!el) return;
    el.scrollIntoView({ behavior:"smooth", block:"center" });
    setTimeout(() => {
      const dh = getDockH();
      window.scrollBy({ top: -Math.min(160, dh*0.6), behavior:"smooth" });
    }, 250);
  }

  function setActive(idx){
    activeIdx = idx;
    document.querySelectorAll(".msg").forEach(m => m.classList.remove("active"));
    const el = document.querySelector('.msg[data-idx="'+idx+'"]');
    if (el) el.classList.add("active");
  }

  function render(){
    stopSpeak();

    const vKey = els.variantSel.value;
    const v = VARS.find(x => x.key === vKey) || VARS[0];
    const pace = els.paceSel.value;
    const showEmojis = !!els.chkEmojis.checked;
    const mysteryN = parseInt(els.mysterySel.value || "0", 10);

    const data = v.data || {};
    const msgs = data.messages || data.thread || data.chat || data.items || [];
    const total = msgs.length;

    if (pace === "all"){
      visibleCount = total;
      els.btnNext.disabled = true;
    } else {
      els.btnNext.disabled = false;
      visibleCount = Math.max(1, Math.min(visibleCount, total || 1));
    }

    els.threadMeta.textContent = total ? (total + " messages") : "No messages found";
    els.status.textContent = (pace === "step") ? ("Showing " + visibleCount + " of " + total) : ("Showing all " + total);

    els.thread.innerHTML = "";
    const vis = msgs.slice(0, visibleCount);

    vis.forEach((m,i) => {
      const name = m.name || m.speaker || m.participant || ("Participant " + (i+1));
      const raw = String(m.text || m.message || m.content || "");
      const emoji = String(m.emoji || m.reaction || "");
      const display = showEmojis ? (raw + (emoji ? " " + emoji : "")) : raw;

      const msg = document.createElement("div");
      msg.className = "msg";
      msg.setAttribute("data-idx", String(i));

      const av = document.createElement("div");
      av.className = "avatar";
      av.textContent = String(name).trim().slice(0,1).toUpperCase() || "?";

      const right = document.createElement("div");
      right.style.flex = "1";

      const meta = document.createElement("div");
      meta.className = "meta";
      const nm = document.createElement("div"); nm.className="name"; nm.textContent = name;
      const idd = document.createElement("div"); idd.className="idx"; idd.textContent = "#" + (i+1);
      meta.appendChild(nm); meta.appendChild(idd);

      const txt = document.createElement("div");
      txt.className = "text";
      const myst = applyMystery(display, i, mysteryN);
      txt.innerHTML = myst.html;

      const btnRow = document.createElement("div");
      btnRow.className = "btnRow";

      const bSpeak = document.createElement("button");
      bSpeak.className = "btn primary";
      bSpeak.type = "button";
      bSpeak.textContent = "Speak";
      bSpeak.addEventListener("click", (e) => { e.stopPropagation(); speak(display, msg); });

      const bUnpack = document.createElement("button");
      bUnpack.className = "btn";
      bUnpack.type = "button";
      bUnpack.textContent = "Unpack";
      bUnpack.addEventListener("click", (e) => {
        e.stopPropagation();
        const extra = m.unpack || m.explain || m.notes || null;
        alert(extra ? (typeof extra === "string" ? extra : JSON.stringify(extra,null,2)) : "No unpack data for this message.");
      });

      btnRow.appendChild(bSpeak);
      btnRow.appendChild(bUnpack);

      right.appendChild(meta);
      right.appendChild(txt);
      right.appendChild(btnRow);

      const row = document.createElement("div");
      row.className = "row";
      row.appendChild(av);
      row.appendChild(right);

      msg.appendChild(row);
      msg.addEventListener("click", () => { setActive(i); scrollToActive(); });

      els.thread.appendChild(msg);
      wireMystery(msg);
    });

    const newActive = Math.max(0, Math.min(visibleCount-1, vis.length-1));
    setActive(newActive);
    setTimeout(scrollToActive, 120);

    // concepts
    els.concepts.innerHTML = "";
    const arr = Array.isArray(concepts) ? concepts : [];
    els.conceptMeta.textContent = arr.length ? (arr.length + " items") : "No concepts";
    if (arr.length){
      arr.slice(0, 80).forEach(c => {
        const term = c.term || c.word || c.title || c.name || "Concept";
        const def = c.definition || c.def || c.meaning || c.explain || "";
        const div = document.createElement("div");
        div.className = "concept";
        div.innerHTML = '<div class="term">'+esc(term)+'</div><div class="def">'+esc(def || "—")+'</div>';
        els.concepts.appendChild(div);
      });
    } else {
      const div = document.createElement("div");
      div.className = "concept";
      div.innerHTML = '<div class="def">No concepts in this pack.</div>';
      els.concepts.appendChild(div);
    }
  }

  els.btnNext.addEventListener("click", () => { visibleCount += 1; render(); });
  els.btnAll.addEventListener("click", () => { els.paceSel.value = "all"; render(); });
  els.btnStop.addEventListener("click", stopSpeak);

  [els.variantSel, els.paceSel, els.chkEmojis, els.chkSpeakEmojis, els.chkKaraoke, els.mysterySel, els.voiceSel].forEach(el => el.addEventListener("change", render));

  render();
})();
</script>
</body>
</html>`;

  downloadHtml(filename, html);
}

