/* app/_features/social/exports/socialThreadExport.ts
   Social Thread HTML exporter (offline-friendly, kid-first)
   - Uses String.raw for the HTML template (prevents \s, \n etc being eaten)
   - IMPORTANT: NO backticks inside the embedded <script> (avoids breaking the TS template)
   - Embeds pack JSON safely as base64
   - Always renders (fallback sample pack + fatal error overlay)
   - Adds classroom-friendly features aligned to Irish Primary English oral language (Stages 1â€“4)
*/
"use client";

export type SocialMessage = {
  id: string;
  speaker: string;
  text: string;
  time?: string | null;
  emoji?: string | null;
  tags?: string[] | null;
};

export type SocialCheck = {
  id: string;
  prompt: string;
  answerKey: string;
};

export type SocialVariantBlock = {
  messages: SocialMessage[];
  checks: SocialCheck[];
};

export type SocialConcept = {
  id: string;
  term: string;
  definition: string;
  example?: string | null;
};

export type SocialThreadPack = {
  title: string;
  subtitle: string;
  meta?: Record<string, any>;
  concepts: SocialConcept[];
  standard: SocialVariantBlock;
  supported: SocialVariantBlock;
};

export type ExportHtmlOptions = {
  // Defaults for exported Social Thread HTML
  defaultLens?: string;                 // e.g. "builder" | "debate"
  defaultAutoVoices?: boolean;
  defaultSpeakEmojis?: boolean;
  defaultShowEmojis?: boolean;
  defaultPace?: "all" | "step" | string;
  initialVisibleCount?: number;

  // Allow forward-compatible options without breaking builds
  [key: string]: any;
  defaultLens?: string; // e.g. "builder" | "debate"
  defaultVariant?: "standard" | "supported";
  defaultPace?: "step" | "all";
  initialVisibleCount?: number;
  defaultStage?: 1 | 2 | 3 | 4;
  defaultShowEmojis?: boolean;
  defaultSpeakEmojis?: boolean;
};

export type ExportOpts = {
  // Precompute options for offline/social-thread exports
  precomputeUnpacks?: boolean;
  precomputeLens?: string;                // e.g. "builder" | "debate"
  precomputeLimitPerVariant?: number;
  htmlOptions?: ExportHtmlOptions;

  // Allow forward-compatible options without breaking builds
  [key: string]: any;
  pack: SocialThreadPack;
  fileBaseName?: string;
  htmlOptions?: ExportHtmlOptions;
};

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function safeFileName(s: string) {
  return (
    String(s || "social-thread")
      .trim()
      .replace(/[^\w\s\-]+/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\s/g, "-")
      .slice(0, 120) || "social-thread"
  );
}

function normalizePackForExport(pack: SocialThreadPack): SocialThreadPack {
  const p: SocialThreadPack = JSON.parse(JSON.stringify(pack || {}));

  p.title = String((p as any).title || "Social Thread");
  p.subtitle = String((p as any).subtitle || "");
  p.concepts = Array.isArray((p as any).concepts) ? (p as any).concepts : [];

  function normBlock(b: any): SocialVariantBlock {
    const out: SocialVariantBlock = {
      messages: Array.isArray(b?.messages) ? b.messages : [],
      checks: Array.isArray(b?.checks) ? b.checks : [],
    };

    out.messages = out.messages.map((m: any, i: number) => ({
      id: String(m?.id ?? `m-${i + 1}`),
      speaker: String(m?.speaker ?? "Speaker"),
      text: String(m?.text ?? ""),
      time: m?.time == null ? null : String(m.time),
      emoji: m?.emoji == null ? null : String(m.emoji),
      tags: Array.isArray(m?.tags) ? m.tags.map(String) : null,
    }));

    return out;
  }

  (p as any).standard = normBlock((p as any).standard);
  (p as any).supported = normBlock((p as any).supported);

  return p;
}

function downloadTextFile(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2500);
}

function b64EncodeUtf8(s: string) {
  // Symmetric with decodeURIComponent(escape(atob(...))) in the HTML runtime.
  return btoa(unescape(encodeURIComponent(s)));
}

export async function exportSocialThreadHtml(opts: ExportOpts) {
  const pack = normalizePackForExport(opts.pack);
  const title = pack?.title || "Social Thread";
  const base = safeFileName(opts.fileBaseName || title);
  const date = new Date().toISOString().slice(0, 10);
  const filename = `${base}-social-thread-${date}.html`;

  const htmlOptions: ExportHtmlOptions = {
    defaultVariant: opts.htmlOptions?.defaultVariant || "standard",
    defaultPace: opts.htmlOptions?.defaultPace || "step",
    initialVisibleCount: clamp(
      (opts.htmlOptions?.defaultPace || "step") === "step"
        ? 1
        : Number(opts.htmlOptions?.initialVisibleCount ?? 1),
      0,
      10
    ),
    defaultStage: (opts.htmlOptions?.defaultStage ?? 2) as 1 | 2 | 3 | 4,
    defaultShowEmojis: opts.htmlOptions?.defaultShowEmojis ?? true,
    defaultSpeakEmojis: opts.htmlOptions?.defaultSpeakEmojis ?? false,
  };

  const packB64 = b64EncodeUtf8(JSON.stringify(pack));
  const optsB64 = b64EncodeUtf8(JSON.stringify(htmlOptions));

  const html = buildHtml(packB64, optsB64, base);
  downloadTextFile(filename, html);
}

function buildHtml(packB64: string, optsB64: string, baseTitle: string) {
  // NOTE: String.raw keeps backslashes intact.
  // ALSO NOTE: the embedded <script> must NOT contain backticks, or it will break this template.
  return String.raw`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(baseTitle)} â€” Social Thread</title>
<style>
  :root{
    --bg:#0b1220;
    --card:#111b2e;
    --text:#e9eefc;
    --muted:#aab7e6;
    --line:rgba(255,255,255,.10);
    --good:#4ade80;
    --warn:#fbbf24;
    --bad:#fb7185;
    --accent:#60a5fa;
    --accent2:#a78bfa;
    --shadow:0 12px 30px rgba(0,0,0,.35);
    --r:18px;
  }
  html,body{height:100%;}
  body{
    margin:0;
    background:radial-gradient(1200px 600px at 10% 0%, rgba(96,165,250,.14), transparent 60%),
               radial-gradient(1200px 600px at 90% 0%, rgba(167,139,250,.12), transparent 60%),
               var(--bg);
    color:var(--text);
    font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
  }
  .wrap{max-width:1100px;margin:0 auto;padding:18px 16px 110px;}
  .topbar{display:flex;gap:12px;align-items:flex-start;justify-content:space-between;margin-bottom:14px;}
  .title h1{margin:0;font-size:22px;line-height:1.1;}
  .title .sub{color:var(--muted);margin-top:6px;font-size:13px;max-width:60ch;}
  .card{
    background:linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.03));
    border:1px solid var(--line);
    border-radius:var(--r);
    box-shadow:var(--shadow);
    overflow:hidden;
  }
  .controls{display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:flex-end;}
  .chip, button, select{
    background:rgba(255,255,255,.06);
    color:var(--text);
    border:1px solid var(--line);
    border-radius:999px;
    padding:8px 10px;
    font-size:13px;
  }
  button{cursor:pointer}
  button:hover{border-color:rgba(255,255,255,.25)}
  button:disabled{opacity:.5;cursor:not-allowed}
  select{padding:8px 12px}
  .tabs{display:flex;gap:8px;padding:10px;border-bottom:1px solid var(--line);background:rgba(0,0,0,.18);}
  .tab{
    padding:8px 12px;border-radius:999px;cursor:pointer;user-select:none;
    border:1px solid transparent;color:var(--muted);font-weight:700;font-size:13px;
  }
  .tab.active{color:var(--text);border-color:rgba(255,255,255,.20);background:rgba(255,255,255,.06)}
  .panel{display:none;padding:14px;}
  .panel.active{display:block;}

  .chat{display:flex;gap:14px;align-items:flex-start;}
  .msgs{flex:1;display:flex;flex-direction:column;gap:10px;}
  .msg{
    display:grid;grid-template-columns:42px 1fr;gap:10px;
    padding:10px;border-radius:16px;border:1px solid var(--line);background:rgba(0,0,0,.18);
  }
  .msg.selected{outline:2px solid rgba(96,165,250,.55);}
  .msg.speaking{border-color:rgba(167,139,250,.60); background:rgba(167,139,250,.10);}
  .tailEmoji{margin-left:6px; opacity:.95;}
  .ava{
    width:42px;height:42px;border-radius:14px;display:grid;place-items:center;
    background:linear-gradient(135deg, rgba(96,165,250,.35), rgba(167,139,250,.30));
    border:1px solid rgba(255,255,255,.18);
    font-size:20px;
  }
  .hdr{display:flex;gap:10px;align-items:center;justify-content:space-between}
  .name{font-weight:900}
  .muted{color:var(--muted)}
  .k{display:inline-block;padding:2px 8px;border-radius:999px;background:rgba(255,255,255,.06);border:1px solid var(--line);font-size:12px;color:var(--muted);margin-left:6px}
  .bubble{margin-top:6px;line-height:1.45}
  .bubble.supported{font-size:16px;line-height:1.65;letter-spacing:.2px}
  .bubble .w{padding:1px 0;border-radius:6px}
  .bubble .w.hl{background:rgba(96,165,250,.25); outline:1px solid rgba(96,165,250,.22)}
  .actions{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
  .mini{padding:6px 9px;font-size:12px;border-radius:999px;border:1px solid var(--line);background:rgba(255,255,255,.05);color:var(--text);cursor:pointer;}
  .mini:hover{border-color:rgba(255,255,255,.25)}
  .reactions{display:flex;gap:6px;align-items:center;margin-top:8px;flex-wrap:wrap}
  .react{font-size:13px;padding:5px 9px;border-radius:999px;border:1px solid var(--line);background:rgba(255,255,255,.04);cursor:pointer}
  .react strong{margin-left:6px;color:var(--muted);font-size:12px}

  .side{width:330px;flex:0 0 330px}
  .side .box{padding:12px;border-bottom:1px solid var(--line)}
  .side h3{margin:0 0 8px 0;font-size:14px}
  .sticker{background:rgba(255,255,255,.05);border:1px solid var(--line);border-radius:14px;padding:10px;margin-top:8px}

  .grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
  @media (max-width: 900px){
    .chat{flex-direction:column}
    .side{width:auto;flex:1}
    .grid{grid-template-columns:1fr}
  }
  .concept{padding:12px;border-radius:16px;border:1px solid var(--line);background:rgba(0,0,0,.18)}
  .concept .term{font-weight:900}
  .concept .hint{margin-top:6px;color:var(--muted);font-size:12px}
  .concept.vocab .def,.concept.vocab .ex{margin-top:6px;color:var(--muted);display:none}
  .concept .ex{font-size:13px}
  .concept.vocab.revealed .def,.concept.vocab.revealed .ex{display:block}
  .concept.vocab.revealed .hint{display:none}

  .bottombar{
    position:fixed;left:0;right:0;bottom:0;z-index:50;
    background:rgba(10,16,30,.94);
    border-top:1px solid var(--line);
    box-shadow: 0 -10px 28px rgba(0,0,0,.35);
    padding:10px 12px;
  }
  .barwrap{max-width:1100px;margin:0 auto;display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap}
  .progress{color:var(--muted);font-size:13px}

  .fatal{
    white-space:pre-wrap;
    background:rgba(251,113,133,.12);
    border:1px solid rgba(251,113,133,.30);
    padding:12px;border-radius:16px;margin:12px 0;display:none;
  }
</style>
</head>
<body>
<div class="wrap">
  <div id="fatal" class="fatal"></div>

  <div class="topbar">
    <div class="title">
      <h1 id="hTitle">Social Thread</h1>
      <div id="hSub" class="sub"></div>
    </div>
    <div class="controls">
      <span class="chip">Curriculum stage:
        <select id="stageSel">
          <option value="1">Stage 1</option>
          <option value="2">Stage 2</option>
          <option value="3">Stage 3</option>
          <option value="4">Stage 4</option>
        </select>
      </span>

      <span class="chip">Variant:
        <select id="variantSel">
          <option value="standard">Standard</option>
          <option value="supported">Supported</option>
        </select>
      </span>

      <span class="chip">Voice A:
        <select id="voiceSel"><option value="">(loadingâ€¦)</option></select>
      </span>

      <span class="chip">Voice B:
        <select id="voiceSelB"><option value="">(loadingâ€¦)</option></select>
        <label style="margin-left:8px;cursor:pointer">
          <input id="autoVoicesChk" type="checkbox" style="vertical-align:middle;margin-right:6px" />
          Auto
        </label>
      </span>

      <button id="btnKaraoke">ðŸŽ¤ Karaoke</button>
      <button id="btnReadVisible">ðŸ”Š Read visible</button>
      <button id="btnStop">â¹ Stop</button>
      <button id="btnToggleEmojis">ðŸ™‚ Emojis</button>
      <button id="btnMask">ðŸ¦Š Mask names</button>
      <button id="btnMystery">ðŸ•µï¸ Mystery words</button>
    </div>
  </div>

  <div class="card">
    <div class="tabs">
      <div class="tab active" data-tab="chat">Chat</div>
      <div class="tab" data-tab="vocab">Vocab</div>
      <div class="tab" data-tab="respect">Respect</div>
      <div class="tab" data-tab="writing">Writing</div>
    </div>

    <div class="panel active" id="panel-chat">
      <div class="chat">
        <div class="msgs" id="msgs"></div>
        <div class="side">
          <div class="box">
            <h3>Teacher stickers</h3>
            <div class="muted" id="stickersHint">Reveal a message to see supports.</div>
            <div id="stickers"></div>
          </div>
          <div class="box">
            <h3>Soundboard</h3>
            <div class="muted">Tap a starter to practise respectful talk moves.</div>
            <div id="soundboard" style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap"></div>
          </div>
          <div class="box">
            <h3>Quick rules</h3>
            <div class="muted">Listen, respond, and give reasons. Keep it kind.</div>
            <div style="margin-top:10px">
              <span class="k">Explain</span>
              <span class="k">Justify</span>
              <span class="k">Ask</span>
              <span class="k">Build on ideas</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="panel" id="panel-vocab">
      <div class="muted" style="margin-bottom:10px">Key words from the thread (for shared class learning).</div>
      <div id="vocabGrid" class="grid"></div>
    </div>

    <div class="panel" id="panel-respect">
      <div class="muted" style="margin-bottom:10px">A playful â€œtalk qualityâ€ dashboard (a guide, not a judgement).</div>
      <div id="respectBox"></div>
    </div>

    <div class="panel" id="panel-writing">
      <div class="muted" style="margin-bottom:10px">Turn talk into writing (same learning target, different supports).</div>
      <div id="writingBox"></div>
    </div>
  </div>
</div>

<div class="bottombar">
  <div class="barwrap">
    <div class="progress" id="progress">0 / 0</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button id="btnNext">Next âžœ</button>
      <button id="btnAll">Show all</button>
      <button id="btnTop">Top â†‘</button>
      <span class="chip">Speed:
        <select id="speedSel">
          <option value="0.85">Slow & clear</option>
          <option value="1.0" selected>Normal</option>
          <option value="1.07">Expressive</option>
        </select>
      </span>
      </div>
  </div>
</div>

<script>
(function(){
  var fatalEl = document.getElementById("fatal");
  function fatal(err){
    var msg = (err && (err.stack || err.message)) ? (err.stack || err.message) : String(err);
    fatalEl.style.display = "block";
    fatalEl.textContent = "Export script crashed. Details:\n\n" + msg;
  }

  function decodeB64(b64){
    try{ return decodeURIComponent(escape(atob(b64))); } catch(e){ return null; }
  }

  var PACK_B64 = "${packB64}";
  var OPTS_B64 = "${optsB64}";

  var PACK = null;
  var OPTS = null;

  try{
    var pJson = decodeB64(PACK_B64);
    var oJson = decodeB64(OPTS_B64);
    PACK = pJson ? JSON.parse(pJson) : null;
    OPTS = oJson ? JSON.parse(oJson) : null;
  }catch(e){
    fatal(e); return;
  }

  function samplePack(){
    return {
      title: "Let's Talk About Football!",
      subtitle: "A social thread to practise speaking, listening, and giving reasons.",
      meta: { sample: true },
      concepts: [
        { id:"c1", term:"Teamwork", definition:"Working together to reach a goal.", example:"Teamwork helps a team defend well." },
        { id:"c2", term:"Fair play", definition:"Playing honestly and following rules.", example:"Fair play means no diving or cheating." },
        { id:"c3", term:"Supporter", definition:"A person who cheers for a team.", example:"A supporter wears the team colours." },
        { id:"c4", term:"Strategy", definition:"A plan to help you succeed.", example:"Our strategy was to pass quickly." },
        { id:"c5", term:"Respect", definition:"Being kind and listening to others.", example:"Respect means we donâ€™t interrupt." },
        { id:"c6", term:"Opinion", definition:"What you think or believe.", example:"My opinion is that teamwork matters most." }
      ],
      standard: { messages: [
        { id:"m1", speaker:"Aoife NÃ­ ShÃºilleabhÃ¡in", emoji:"ðŸ§¶", text:"Did anyone watch the match last night? The passing was unreal." },
        { id:"m2", speaker:"Cian Oâ€™Connor", emoji:"ðŸ¦Š", text:"I did! But I think the defence won it. They stayed calm under pressure." },
        { id:"m3", speaker:"Niamh Fitzgerald", emoji:"ðŸŒˆ", text:"My favourite part was the teamwork. Everyone covered for each other." },
        { id:"m4", speaker:"OisÃ­n Murphy", emoji:"ðŸ§­", text:"Fair play matters too. If you win by cheating, did you really win?" },
        { id:"m5", speaker:"RÃ³isÃ­n Walsh", emoji:"ðŸŽ¨", text:"Some supporters get angry online. I think we can disagree with respect." },
        { id:"m6", speaker:"Darragh Keane", emoji:"âš½", text:"Whatâ€™s your strategy when your team is losing? More risk or stay patient?" },
        { id:"m7", speaker:"Saoirse Flynn", emoji:"ðŸ“š", text:"Iâ€™d stay patient and keep possession. Panic makes mistakes." },
        { id:"m8", speaker:"Tadhg Oâ€™Brien", emoji:"ðŸŽ»", text:"Iâ€™d bring on a fast player. Changing energy can change a game." },
        { id:"m9", speaker:"Aoife NÃ­ ShÃºilleabhÃ¡in", emoji:"ðŸ§¶", text:"My opinion: the best teams listen to each other on the pitch." },
        { id:"m10", speaker:"Timmy O'Shea", emoji:"ðŸ—£ï¸", text:"Class chat-starter: What makes a â€œgood teammateâ€ in sport and in school? Explain your reasons." }
      ], checks: [] },
      supported: { messages: [
        { id:"m1", speaker:"Aoife NÃ­ ShÃºilleabhÃ¡in", emoji:"ðŸ§¶", text:"Did you watch the match? The passing was very good." },
        { id:"m2", speaker:"Cian Oâ€™Connor", emoji:"ðŸ¦Š", text:"I watched it. The defenders stayed calm." },
        { id:"m3", speaker:"Niamh Fitzgerald", emoji:"ðŸŒˆ", text:"Teamwork was my favourite part. People helped each other." },
        { id:"m4", speaker:"OisÃ­n Murphy", emoji:"ðŸ§­", text:"Fair play is important. We should follow rules." },
        { id:"m5", speaker:"RÃ³isÃ­n Walsh", emoji:"ðŸŽ¨", text:"We can disagree and still be respectful." },
        { id:"m6", speaker:"Darragh Keane", emoji:"âš½", text:"If your team is losing, what should you do? Take risks or stay patient?" },
        { id:"m7", speaker:"Saoirse Flynn", emoji:"ðŸ“š", text:"Stay patient. Keep the ball. Donâ€™t panic." },
        { id:"m8", speaker:"Tadhg Oâ€™Brien", emoji:"ðŸŽ»", text:"Change a player to change the energy." },
        { id:"m9", speaker:"Aoife NÃ­ ShÃºilleabhÃ¡in", emoji:"ðŸ§¶", text:"Good teams listen to each other." },
        { id:"m10", speaker:"Timmy O'Shea", emoji:"ðŸ—£ï¸", text:"Class chat: What is a good teammate? Tell one reason." }
      ], checks: [] }
    };
  }

  function ensurePack(p){
    try{
      var okStd = p && p.standard && Array.isArray(p.standard.messages) && p.standard.messages.length;
      var okSup = p && p.supported && Array.isArray(p.supported.messages) && p.supported.messages.length;
      if (!okStd && !okSup) return samplePack();
      if (!okStd) p.standard = samplePack().standard;
      if (!okSup) p.supported = samplePack().supported;
      if (!Array.isArray(p.concepts)) p.concepts = samplePack().concepts;
      return p;
    }catch(e){
      return samplePack();
    }
  }

  PACK = ensurePack(PACK);
  OPTS = OPTS || {};

  var elTitle = document.getElementById("hTitle");
  var elSub = document.getElementById("hSub");
  elTitle.textContent = PACK.title || "Social Thread";
  elSub.textContent = PACK.subtitle || "";

  var stageSel = document.getElementById("stageSel");
  var variantSel = document.getElementById("variantSel");
  var voiceSel = document.getElementById("voiceSel");
  var voiceSelB = document.getElementById("voiceSelB");
  var autoVoicesChk = document.getElementById("autoVoicesChk");
  var btnKaraoke = document.getElementById("btnKaraoke");
  var speedSel = document.getElementById("speedSel");
  var btnToggleEmojis = document.getElementById("btnToggleEmojis");
  var btnMask = document.getElementById("btnMask");
  var btnMystery = document.getElementById("btnMystery");

  var msgsEl = document.getElementById("msgs");
  var stickersEl = document.getElementById("stickers");
  var stickersHint = document.getElementById("stickersHint");
  var soundboardEl = document.getElementById("soundboard");

  var vocabGrid = document.getElementById("vocabGrid");
  var respectBox = document.getElementById("respectBox");
  var writingBox = document.getElementById("writingBox");

  var progressEl = document.getElementById("progress");
  var btnNext = document.getElementById("btnNext");
  var btnAll = document.getElementById("btnAll");
  var btnTop = document.getElementById("btnTop");
  var btnStop = document.getElementById("btnStop");
  var btnReadVisible = document.getElementById("btnReadVisible");

  var tabs = Array.prototype.slice.call(document.querySelectorAll(".tab"));
  tabs.forEach(function(t){
    t.addEventListener("click", function(){
      tabs.forEach(function(x){ x.classList.remove("active"); });
      t.classList.add("active");
      var k = t.getAttribute("data-tab");
      Array.prototype.slice.call(document.querySelectorAll(".panel")).forEach(function(p){ p.classList.remove("active"); });
      var target = document.getElementById("panel-" + k);
      if (target) target.classList.add("active");
    });
  });

  var state = {
    stage: Number(OPTS.defaultStage || 2),
    variant: String(OPTS.defaultVariant || "standard"),
    pace: String(OPTS.defaultPace || "step"),
    visibleCount: Number(OPTS.initialVisibleCount != null ? OPTS.initialVisibleCount : 1),
    showEmojis: (OPTS.defaultShowEmojis !== false),
    maskNames: false,
    mystery: false,
    karaoke: true,
    autoVoices: false,
    voiceBURI: "",
    voiceURI: ""
  };
  stageSel.value = String(state.stage);
  variantSel.value = state.variant;

  function currentBlock(){
    return state.variant === "supported" ? PACK.supported : PACK.standard;
  }

  function maskedName(name){
    if (!state.maskNames) return name;
    var animals = ["ðŸ¦Š Fox","ðŸ¦¦ Otter","ðŸ¦‰ Owl","ðŸ¦ Raccoon","ðŸ§ Penguin","ðŸ¬ Dolphin","ðŸ¦ Lion","ðŸ¼ Panda"];
    var sum = 0;
    for (var i=0;i<name.length;i++) sum += name.charCodeAt(i);
    return animals[sum % animals.length];
  }

  var selectedIdx = -1;
  var speakingIdx = -1;
  var scrollAfterRender = false;

  function speakerHash(name){
    var s = String(name || "");
    var h = 0;
    for (var i=0;i<s.length;i++) { h = ((h<<5) - h) + s.charCodeAt(i); h |= 0; }
    return Math.abs(h);
  }

  function voiceForSpeaker(name){
    // We don't reliably know "male/female" from browser voices across devices.
    // Instead: Teacher chooses Voice A and Voice B, and we assign speakers consistently by name.
    if (!state.autoVoices) return state.voiceURI || "";
    var a = state.voiceURI || "";
    var b = state.voiceBURI || a;
    return (speakerHash(name) % 2 === 0) ? a : b;
  }

  function updateMsgClasses(){
    var nodes = msgsEl.querySelectorAll(".msg");
    nodes.forEach(function(node){
      var i = Number(node.getAttribute("data-mi") || "-1");
      node.classList.toggle("selected", i === selectedIdx);
      node.classList.toggle("speaking", i === speakingIdx);
    });
  }

  function setSelected(i){
    selectedIdx = i;
    updateMsgClasses();
  }

  function setSpeaking(i){
    speakingIdx = i;
    updateMsgClasses();
  }

  function normText(s){ return String(s||"").replace(/\s+/g," ").trim(); }

  function stripEmojis(s){
    var t = String(s||"");
    try{
      // Modern browsers: remove emoji/pictographs via Unicode property escapes
      t = t.replace(/\p{Extended_Pictographic}/gu, "");
    }catch(e){
      // Fallback: remove common emoji ranges + surrogate pairs
      t = t.replace(/[\u2600-\u27BF]/g, "");
      t = t.replace(/[\uD83C-\uDBFF][\uDC00-\uDFFF]/g, "");
    }
    // Remove variation selectors + zero-width joiner
    t = t.replace(/[\uFE0E\uFE0F\u200D]/g, "");
    return t.replace(/\s+/g, " ").trim();
  }

  var SOUND = {
    1: ["I agree.","I likeâ€¦","I thinkâ€¦","Can you say that again?","Becauseâ€¦"],
    2: ["I agree becauseâ€¦","I disagree becauseâ€¦","My reason isâ€¦","Can you explain?","In my opinionâ€¦"],
    3: ["I see your point, butâ€¦","Another example isâ€¦","I want to addâ€¦","What makes you think that?","Letâ€™s summariseâ€¦"],
    4: ["I can justify that becauseâ€¦","The evidence isâ€¦","A counterpoint isâ€¦","Letâ€™s build on that ideaâ€¦","Can we agree onâ€¦?"]
  };

  function renderSoundboard(){
    soundboardEl.innerHTML = "";
    var list = SOUND[state.stage] || SOUND[2];
    list.forEach(function(txt){
      var b = document.createElement("button");
      b.className = "mini";
      b.textContent = txt;
      b.addEventListener("click", function(){
        try{ navigator.clipboard && navigator.clipboard.writeText && navigator.clipboard.writeText(txt); }catch(e){}
        b.textContent = "âœ“ Copied";
        setTimeout(function(){ b.textContent = txt; }, 800);
      });
      soundboardEl.appendChild(b);
    });
  }

  function escapeRegExp(s){
    return String(s||"").replace(/[.*+?^$\{\}()|[\]\\]/g, "\\$&");
  }

  function applyMysteryToBubble(text){
    if (!state.mystery) return escapeHtml(text);
    var terms = (PACK.concepts || []).map(function(c){ return String(c.term||"").trim(); }).filter(Boolean).slice(0, 10);
    if (!terms.length) return escapeHtml(text);

    var out = String(text || "");
    terms.sort(function(a,b){ return b.length - a.length; }).forEach(function(term){
      var re = new RegExp(escapeRegExp(term), "gi");
      out = out.replace(re, function(m){ return "[[MYST:" + m + "]]"; });
    });

    // replace markers with blurred spans
    var escaped = escapeHtml(out);
    return escaped.replace(/\[\[MYST:([^\]]+)\]\]/g, function(_all, w){
      return '<span class="myst" data-w="' + escapeAttr(w) + '" style="filter:blur(5px);cursor:pointer;border-bottom:1px dashed rgba(255,255,255,.35)">' + escapeHtml(w) + "</span>";
    });
  }

  function renderVocab(){
    vocabGrid.innerHTML = "";
    var list = (PACK.concepts || []).slice(0, 12);
    list.forEach(function(c){
      var d = document.createElement("div");
      d.className = "concept vocab";
      d.setAttribute("role", "button");
      d.setAttribute("tabindex", "0");

      var html = "";
      html += '<div class="term">' + escapeHtml(c.term) + "</div>";
      html += '<div class="hint">Tap to reveal meaning</div>';
      html += '<div class="def">' + escapeHtml(c.definition) + "</div>";
      if (c.example) html += '<div class="ex"><span class="muted">Example:</span> ' + escapeHtml(c.example) + "</div>";

      d.innerHTML = html;

      function toggle(){
        d.classList.toggle("revealed");
      }

      d.addEventListener("click", toggle);
      d.addEventListener("keydown", function(e){
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); }
      });

      vocabGrid.appendChild(d);
    });
  }

  function stars(n){
    var nn = Math.max(0, Math.min(5, n|0));
    return "â˜…â˜…â˜…â˜…â˜…â˜†â˜†â˜†â˜†â˜†".slice(5 - nn, 10 - nn);
  }

  function scoreVisible(messages){
    var vis = messages.slice(0, state.visibleCount);
    var joined = vis.map(function(m){ return stripEmojis(m.text || ""); }).join(" ").toLowerCase();
    var kindness = (joined.match(/\b(please|thanks|thank you|sorry|respect)\b/g) || []).length;
    var questions = (joined.match(/\?/g) || []).length;
    var reasons = (joined.match(/\b(because|so|therefore|reason)\b/g) || []).length;
    var interrupt = (joined.match(/\b(stupid|shut up|hate)\b/g) || []).length;
    return {
      kindness: Math.max(0, Math.min(5, kindness)),
      questions: Math.max(0, Math.min(5, questions)),
      reasons: Math.max(0, Math.min(5, reasons)),
      penalty: Math.max(0, Math.min(5, interrupt))
    };
  }

  function renderRespect(){
    var msgs = currentBlock().messages || [];
    var s = scoreVisible(msgs);
    var kind = Math.max(0, Math.min(5, s.kindness - s.penalty));
    respectBox.innerHTML =
      '<div class="concept"><div class="term">Kindness</div><div class="def">' + stars(kind) +
      '</div><div class="ex muted">Try: please/thanks, no put-downs, listen first.</div></div>' +
      '<div class="concept" style="margin-top:10px"><div class="term">Questions</div><div class="def">' + stars(s.questions) +
      '</div><div class="ex muted">Try: â€œCan you explain?â€, â€œWhat makes you think that?â€</div></div>' +
      '<div class="concept" style="margin-top:10px"><div class="term">Reasons</div><div class="def">' + stars(s.reasons) +
      '</div><div class="ex muted">Try: â€œI thinkâ€¦ becauseâ€¦â€, â€œMy reason isâ€¦â€</div></div>';
  }

  function renderWriting(){
    var scaff = state.variant === "supported";
    var prompts = scaff ? [
      "Write a short reply to message 6. Use: I thinkâ€¦ becauseâ€¦",
      "Summarise the chat in 3 short sentences.",
      "Write one kind disagreement. Use: I see your point, butâ€¦"
    ] : [
      "Write a thoughtful reply to message 6, giving two reasons.",
      "Summarise the conversation in 3 bullet points: main idea, evidence, conclusion.",
      "Rewrite one message to make it more respectful or clearer, without changing meaning.",
      "Turn the chat into a short story with a beginning, middle, and end."
    ];
    writingBox.innerHTML = prompts.map(function(p){
      return '<div class="concept"><div class="term">Task</div><div class="def">' + escapeHtml(p) + "</div></div>";
    }).join("");
  }

  // Speech
  var VOICES = [];
  function loadVoices(){
    VOICES = window.speechSynthesis ? speechSynthesis.getVoices() : [];
    function fillSelect(sel){
      sel.innerHTML = "";
      var opt0 = document.createElement("option");
      opt0.value = "";
      opt0.textContent = VOICES.length ? "(default)" : "(no voices found)";
      sel.appendChild(opt0);

      VOICES.forEach(function(v){
        var o = document.createElement("option");
        o.value = v.voiceURI;
        o.textContent = v.name + " â€” " + v.lang;
        sel.appendChild(o);
      });
    }

    fillSelect(voiceSel);
    fillSelect(voiceSelB);

    // Prefer an Irish English voice when available
    var pref = VOICES.find(function(v){ return /en-IE/i.test(v.lang); }) ||
               VOICES.find(function(v){ return /English/i.test(v.name); });

    if (pref && !state.voiceURI) state.voiceURI = pref.voiceURI;

    // Default B to "a different English-ish voice" if possible
    if (!state.voiceBURI) {
      var b = VOICES.find(function(v){ return v.voiceURI !== state.voiceURI && /en/i.test(v.lang); }) ||
              VOICES.find(function(v){ return v.voiceURI !== state.voiceURI; });
      if (b) state.voiceBURI = b.voiceURI;
    }

    voiceSel.value = state.voiceURI || "";
    voiceSelB.value = state.voiceBURI || "";
    voiceSelB.disabled = !state.autoVoices;
  }

  if (window.speechSynthesis) {
    loadVoices();
    speechSynthesis.onvoiceschanged = function(){ loadVoices(); };
  } else {
    voiceSel.innerHTML = "<option value=''>TTS not available</option>";
  }

  function pickVoice(uri){
    var u = uri || "";
    if (!u) return null;
    return VOICES.find(function(v){ return v.voiceURI === u; }) || null;
  }

  function stopSpeak(){
    try{ window.speechSynthesis && speechSynthesis.cancel(); }catch(e){}
    setSpeaking(-1);
  }

  function speakText(text, voiceURI, onBoundary, onEnd){
    stopSpeak();
    if (!window.speechSynthesis) return;
    var u = new SpeechSynthesisUtterance(text);
    var v = pickVoice(voiceURI);
    if (v) u.voice = v;
    u.rate = Number(speedSel.value || 1.0);
    u.pitch = 1.0;
    u.onboundary = function(ev){ if (onBoundary) onBoundary(ev); };
    u.onend = function(){ if (onEnd) onEnd(); };
    speechSynthesis.speak(u);
    return u;
  }

  function wrapWords(text){
    var parts = normText(text).split(" ");
    return parts.map(function(p,i){
      return '<span class="w" data-i="' + i + '">' + escapeHtml(p) + (i < parts.length - 1 ? " " : "") + "</span>";
    }).join("");
  }

  function setHighlight(container, index){
    var ws = container.querySelectorAll(".w");
    ws.forEach(function(w){ w.classList.remove("hl"); });
    var w = container.querySelector('.w[data-i="' + index + '"]');
    if (w) w.classList.add("hl");
  }

  function renderStickers(m){
    stickersEl.innerHTML = "";
    if (!m) { stickersHint.textContent = "Reveal a message to see supports."; return; }
    stickersHint.textContent = "Helpers for the last revealed message:";
    var txt = stripEmojis(String(m.text || ""));
    var hasQ = txt.indexOf("?") >= 0;
    var hasBecause = /\bbecause\b/i.test(txt);

    var items = [];
    items.push({ title:"Talk move", body: hasQ ? "Answer the question and give a reason." : "Add a reason: â€œbecause â€¦â€" });
    items.push({ title:"Listening", body:"Start with: â€œI heard you sayâ€¦â€ then respond." });
    items.push({ title:"Respect", body:"Disagree kindly: â€œI see your point, butâ€¦â€" });
    if (!hasBecause) items.push({ title:"Reasons", body:"Try: â€œI thinkâ€¦ becauseâ€¦â€" });
    if (state.variant === "supported") items.push({ title:"Sentence starter", body:"I think ______ because ______." });

    items.forEach(function(it){
      var d = document.createElement("div");
      d.className = "sticker";
      d.innerHTML = "<b>" + escapeHtml(it.title) + "</b><div class='muted' style='margin-top:6px'>" + escapeHtml(it.body) + "</div>";
      stickersEl.appendChild(d);
    });
  }

  function render(){
    var block = currentBlock();
    var msgs = block.messages || [];
    var total = msgs.length;

    if (state.pace === "all") state.visibleCount = total;
    state.visibleCount = Math.max(0, Math.min(total, state.visibleCount));

    progressEl.textContent = state.visibleCount + " / " + total;
    btnNext.disabled = state.visibleCount >= total;

    msgsEl.innerHTML = "";

    var visible = msgs.slice(0, state.visibleCount);
    visible.forEach(function(m, idx){
      var msg = document.createElement("div");
      msg.className = "msg";
      msg.setAttribute("data-mi", String(idx));

      var emoji = (state.showEmojis && m.emoji) ? String(m.emoji) : "ðŸ’¬";
      var spk = maskedName(String(m.speaker || "Speaker"));
      var time = m.time ? String(m.time) : "";

      var bubbleClass = (state.variant === "supported") ? "bubble supported" : "bubble";
      var cleanText = stripEmojis(m.text);
      var bubbleHtml = state.mystery ? applyMysteryToBubble(cleanText) : (state.karaoke ? wrapWords(cleanText) : escapeHtml(cleanText));
      var tail = (state.showEmojis && m.emoji) ? '<span class="tailEmoji" aria-hidden="true">' + escapeHtml(String(m.emoji)) + "</span>" : "";
      if (state.showEmojis && m.emoji) bubbleHtml += ' <span class="tailEmoji" aria-hidden="true">' + escapeHtml(String(m.emoji)) + "</span>";

      var html = "";
      html += '<div class="ava">' + escapeHtml(emoji) + "</div>";
      html += "<div>";
      html += '<div class="hdr"><div>';
      html += '<span class="name">' + escapeHtml(spk) + "</span>";
      if (time) html += '<span class="k">' + escapeHtml(time) + "</span>";
      if (state.showEmojis && m.emoji) html += '<span class="k">' + escapeHtml(String(m.emoji)) + "</span>";
      html += '</div><div class="actions">';
      html += '<button class="mini" data-act="speak" data-idx="' + idx + '">ðŸ”Š Speak</button>';
      html += "</div></div>";
      html += '<div class="' + bubbleClass + '" data-bubble="' + idx + '">' + bubbleHtml + tail + "</div>";
      html += '<div class="reactions">';
      ["ðŸ‘","ðŸ˜‚","ðŸ˜®","ðŸ¤”","â¤ï¸"].forEach(function(r){
        html += '<span class="react" data-react="' + r + '" data-idx="' + idx + '">' + r + ' <strong id="rc-' + idx + '-' + r + '">0</strong></span>';
      });
      html += "</div>";
      html += "</div>";

      msg.innerHTML = html;
      msgsEl.appendChild(msg);
    });

    updateMsgClasses();

    // Click a message to select/highlight it
    Array.prototype.slice.call(msgsEl.querySelectorAll(".msg")).forEach(function(node){
      node.addEventListener("click", function(e){
        // avoid stealing clicks from buttons inside
        if (e && e.target && (e.target.tagName === "BUTTON" || e.target.closest && e.target.closest("button"))) return;
        var i = Number(node.getAttribute("data-mi") || "-1");
        if (i >= 0) setSelected(i);
      });
    });

    // Auto-scroll when new messages are revealed
    if (scrollAfterRender) {
      scrollAfterRender = false;
      try{
        var last = msgsEl.lastElementChild;
        if (last) {
          var footer = document.querySelector(".bottombar");
          var footerH = footer ? footer.getBoundingClientRect().height : 0;
          var pad = 14;
          var rect = last.getBoundingClientRect();
          var viewBottom = window.innerHeight - footerH - pad;
          if (rect.bottom > viewBottom) {
            window.scrollBy({ top: rect.bottom - viewBottom, behavior:"smooth" });
          } else if (rect.top < pad) {
            window.scrollBy({ top: rect.top - pad, behavior:"smooth" });
          }
        }
      }catch(e){}
    }

    // mystery click reveal
    Array.prototype.slice.call(msgsEl.querySelectorAll(".myst")).forEach(function(el){
      el.addEventListener("click", function(){ el.style.filter = "none"; });
    });

    // per-message speak
    Array.prototype.slice.call(msgsEl.querySelectorAll('button[data-act="speak"]')).forEach(function(btn){
      btn.addEventListener("click", function(){
        var i = Number(btn.getAttribute("data-idx") || "0");
        var m = visible[i];
        if (!m) return;

        var raw = String(m.text || "");
        var base = stripEmojis(raw);
        var txt = base;
        setSelected(i);
        setSpeaking(i);

        var bubble = msgsEl.querySelector('.bubble[data-bubble="' + i + '"]');
        if (!bubble) { speakText(txt); return; }

        var words = normText(base).split(" ");
        var acc = 0;
        var boundaries = words.map(function(w, wi){
          var start = acc; acc += w.length + 1; return { wi: wi, start: start };
        });

        var vuri = voiceForSpeaker(m.speaker);
        speakText(txt, vuri, function(ev){
          try{
            if (!ev || typeof ev.charIndex !== "number") return;
            var ci = ev.charIndex;
            var wi = 0;
            for (var j=0;j<boundaries.length;j++){
              if (boundaries[j].start <= ci) wi = boundaries[j].wi;
              else break;
            }
            if (state.karaoke && !state.mystery) setHighlight(bubble, wi);
          }catch(e){}
        }, function(){ setSpeaking(-1); });
      });
    });

    // reactions (local)
    var storeKey = "react:" + (PACK.title || "") + ":" + state.variant;
    var store = {};
    try{ store = JSON.parse(localStorage.getItem(storeKey) || "{}"); }catch(e){ store = {}; }

    Array.prototype.slice.call(msgsEl.querySelectorAll(".react")).forEach(function(el){
      var r = el.getAttribute("data-react");
      var i = el.getAttribute("data-idx");
      var k = i + ":" + r;
      var n = Number(store[k] || 0);
      var cnt = document.getElementById("rc-" + i + "-" + r);
      if (cnt) cnt.textContent = String(n);

      el.addEventListener("click", function(){
        store[k] = Number(store[k] || 0) + 1;
        try{ localStorage.setItem(storeKey, JSON.stringify(store)); }catch(e){}
        var cnt2 = document.getElementById("rc-" + i + "-" + r);
        if (cnt2) cnt2.textContent = String(store[k]);
      });
    });

    renderStickers(visible.length ? visible[visible.length - 1] : null);
    renderRespect();
    renderWriting();
  }

  // Controls
  btnNext.addEventListener("click", function(){ scrollAfterRender = true; state.visibleCount += 1; render(); });
  btnAll.addEventListener("click", function(){ scrollAfterRender = true; state.pace = "all"; state.visibleCount = (currentBlock().messages || []).length; render(); });
  btnTop.addEventListener("click", function(){ window.scrollTo({ top:0, behavior:"smooth" }); });
  btnStop.addEventListener("click", function(){ stopSpeak(); });
  btnReadVisible.addEventListener("click", function(){
    var block = currentBlock();
    var vis = (block.messages || []).slice(0, state.visibleCount);
    if (!vis.length) return;

    var q = { i: 0, active: true };

    function speakNext(){
      if (!q.active) return;
      if (q.i >= vis.length) { setSpeaking(-1); return; }

      var m = vis[q.i];
      var raw = String(m.text || "");
      var base = stripEmojis(raw);
      var txt = base;

      setSelected(q.i);
      setSpeaking(q.i);

      // Find the matching bubble currently rendered
      var bubble = msgsEl.querySelector('.bubble[data-bubble="' + q.i + '"]');

      var words = normText(base).split(" ");
      var acc = 0;
      var boundaries = words.map(function(w, wi){
        var start = acc; acc += w.length + 1; return { wi: wi, start: start };
      });

      var vuri = voiceForSpeaker(m.speaker);

      speakText(txt, vuri, function(ev){
        try{
          if (!bubble) return;
          if (!state.karaoke || state.mystery) return;
          if (!ev || typeof ev.charIndex !== "number") return;
          var ci = ev.charIndex;
          var wi = 0;
          for (var j=0;j<boundaries.length;j++){
            if (boundaries[j].start <= ci) wi = boundaries[j].wi;
            else break;
          }
          setHighlight(bubble, wi);
        }catch(e){}
      }, function(){
        q.i += 1;
        speakNext();
      });
    }

    // stop button cancels queue via stopSpeak()
    speakNext();
  });

  variantSel.addEventListener("change", function(){
    state.variant = variantSel.value;
    var total = (currentBlock().messages || []).length;
    state.visibleCount = Math.max(0, Math.min(total, state.visibleCount));
    render();
  });

  stageSel.addEventListener("change", function(){
    state.stage = Number(stageSel.value || 2);
    renderSoundboard();
    render();
  });

  btnToggleEmojis.addEventListener("click", function(){
    state.showEmojis = !state.showEmojis;
    btnToggleEmojis.textContent = state.showEmojis ? "ðŸ™‚ Emojis" : "ðŸš« Emojis";
    render();
  });

  btnMask.addEventListener("click", function(){
    state.maskNames = !state.maskNames;
    btnMask.textContent = state.maskNames ? "ðŸ¦Š Names masked" : "ðŸ¦Š Mask names";
    render();
  });

  btnMystery.addEventListener("click", function(){
    state.mystery = !state.mystery;
    btnMystery.textContent = state.mystery ? "ðŸ•µï¸ Mystery ON" : "ðŸ•µï¸ Mystery words";
    render();
  });

  // Karaoke mode (word highlighting while speaking)
  btnKaraoke.textContent = state.karaoke ? "ðŸŽ¤ Karaoke" : "ðŸŽ¤ Karaoke OFF";
  btnKaraoke.addEventListener("click", function(){
    state.karaoke = !state.karaoke;
    btnKaraoke.textContent = state.karaoke ? "ðŸŽ¤ Karaoke" : "ðŸŽ¤ Karaoke OFF";
    render();
  });

  // Auto voices (Teacher chooses Voice A and B)
  voiceSelB.disabled = !state.autoVoices;
  autoVoicesChk.checked = state.autoVoices;

  autoVoicesChk.addEventListener("change", function(){
    state.autoVoices = !!autoVoicesChk.checked;
    voiceSelB.disabled = !state.autoVoices;
  });
  voiceSel.addEventListener("change", function(){ state.voiceURI = voiceSel.value || ""; });
  voiceSelB.addEventListener("change", function(){ state.voiceBURI = voiceSelB.value || ""; });

  window.addEventListener("keydown", function(e){
    if (e.target && ["INPUT","TEXTAREA","SELECT"].indexOf(e.target.tagName) >= 0) return;
    if (e.key === "n" || e.key === "N") { e.preventDefault(); if (!btnNext.disabled) { state.visibleCount += 1; render(); } }
    if (e.key === "a" || e.key === "A") { e.preventDefault(); state.pace="all"; state.visibleCount = (currentBlock().messages || []).length; render(); }
    if (e.key === "s" || e.key === "S") { e.preventDefault(); stopSpeak(); }
    if (e.key === "t" || e.key === "T") { e.preventDefault(); window.scrollTo({ top:0, behavior:"smooth" }); }
  });

  function escapeHtml(s){
    return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
  }
  function escapeAttr(s){
    return escapeHtml(s).replace(/[\x60]/g, "&#96;");
  }

  try{
    renderVocab();
    renderSoundboard();
    render();
  }catch(e){
    fatal(e);
  }
})();
</script>
</body>
</html>`;
}

function escapeHtml(s: string) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
function escapeAttr(s: string) {
  return escapeHtml(s).replace(/[\x60]/g, "&#96;");
}



