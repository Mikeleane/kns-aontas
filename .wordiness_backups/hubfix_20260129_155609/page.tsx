"use client";

import React, { useEffect, useMemo, useState } from "react";
import { buildWordinessSeedFromText, type WordinessSeed } from "../_features/wordiness/buildWordinessSeed";

type Game = { file: string; title: string; desc: string; tags: string[] };

const GAMES: Game[] = [
  { file: "syllable-tiles-smart.html", title: "Syllable Tiles (Smart)", desc: "Chunk + blend with helpful warnings.", tags: ["syllables","phonics","tts"] },
  { file: "wordiness-lab-shapes-sounds.html", title: "Shapes & Sounds Lab", desc: "Rhyme, syllables, and phonological play.", tags: ["phonology","rhyme","syllables"] },
  { file: "wordiness-calm-spell-lab.htm", title: "Calm Spell Lab", desc: "Low-pressure spelling with pacing.", tags: ["spelling","regulation"] },
  { file: "wordiness-focus-finder.htm", title: "Focus Finder", desc: "Gentle attention training with language.", tags: ["attention","executive-function"] },
  { file: "wordiness-morpheme-lego.htm", title: "Morpheme Lego", desc: "Build meaning from prefixes/roots/suffixes.", tags: ["morphology","meaning"] },
  { file: "wordiness-morpheme-mixer.htm", title: "Morpheme Mixer", desc: "Mix and match morphemes (fast mode).", tags: ["morphology","meaning"] },
  { file: "wordiness-word-stress-dj.htm", title: "Word Stress DJ", desc: "Feel stress patterns and rhythm.", tags: ["pronunciation","prosody"] },
  { file: "wordiness-word-stress-dj-remix.htm", title: "Word Stress DJ Remix", desc: "More patterns, more remixing.", tags: ["pronunciation","prosody"] },
  { file: "wordiness-word-order-rails.html", title: "Word Order Rails (Seeded)", desc: "Tap tiles to rebuild sentences in order.", tags: ["grammar","word-order","seeded"] },
  { file: "wordiness-connector-switchboard-seeded.html", title: "Connector Switchboard (Seeded)", desc: "Pick the best connector (because/but/so/etc).", tags: ["connectors","seeded"] },
  { file: "wordiness-wh-question-picker.html", title: "WH Question Picker (Seeded)", desc: "Match answers to Why/When/Where/Who/What.", tags: ["questions","seeded"] },
];

const KEY = "wordiness_seed_json";

function base64UrlFromUtf8(json: string) {
  const b64 = btoa(unescape(encodeURIComponent(json)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export default function WordinessHubPage() {
  const [seed, setSeed] = useState<WordinessSeed | null>(null);
  const [paste, setPaste] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setSeed(JSON.parse(raw));
    } catch {}
  }, []);

  const seedSummary = useMemo(() => {
    if (!seed) return "No seed yet. Generate a Reading Pack or paste text here.";
    const sCount = seed.sentences?.length || 0;
    const wCount = seed.words?.length || 0;
    const src = seed.meta?.source ? ` (${seed.meta.source})` : "";
    return `Seed loaded${src}: ${sCount} sentences, ${wCount} unique words.`;
  }, [seed]);

  function saveSeedFromText(text: string, source: string) {
    const t = (text || "").trim();
    if (!t) return;
    const s = buildWordinessSeedFromText(t, source);
    localStorage.setItem(KEY, JSON.stringify(s));
    setSeed(s);
  }

  function launch(gameFile: string) {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      alert("No seed found. Generate a Reading Pack first, or paste text here.");
      return;
    }
    const seedParam = base64UrlFromUtf8(raw);
    window.open(`/wordiness/${gameFile}#seed=${encodeURIComponent(seedParam)}`, "_blank", "noopener,noreferrer");
  }

  return (
    <div style={{ padding: 16, maxWidth: 1100, margin: "0 auto", fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <img src="/crest.png" alt="" style={{ width: 40, height: 40, borderRadius: 12, objectFit: "cover" }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 900, fontSize: 22 }}>Wordiness Hub</div>
          <div style={{ opacity: 0.75, fontSize: 13 }}>Launch Wordiness games seeded from your Reading Pack (tablet-friendly, teacher-controlled).</div>
        </div>
      </div>

      <div style={{ marginTop: 14, padding: 14, borderRadius: 16, border: "1px solid rgba(0,0,0,.12)", background: "rgba(0,0,0,.04)" }}>
        <div style={{ fontWeight: 800 }}>Current seed</div>
        <div style={{ marginTop: 6, opacity: 0.8 }}>{seedSummary}</div>

        <div style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>Paste text to seed Wordiness (optional)</div>
          <textarea
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            placeholder="Paste a paragraph / story / Reading Pack text here..."
            style={{ width: "100%", minHeight: 110, padding: 10, borderRadius: 12, border: "1px solid rgba(0,0,0,.18)" }}
          />
          <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => saveSeedFromText(paste, "pasted")}
              style={{ padding: "10px 14px", borderRadius: 999, border: "1px solid rgba(0,0,0,.22)", background: "white", fontWeight: 800 }}
            >
              Use pasted text
            </button>
            <button
              type="button"
              onClick={() => { setPaste(""); }}
              style={{ padding: "10px 14px", borderRadius: 999, border: "1px solid rgba(0,0,0,.18)", background: "rgba(255,255,255,.6)" }}
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
        {GAMES.map(g => (
          <div key={g.file} style={{ padding: 14, borderRadius: 16, border: "1px solid rgba(0,0,0,.12)", background: "white" }}>
            <div style={{ fontWeight: 950 }}>{g.title}</div>
            <div style={{ marginTop: 6, opacity: 0.8, fontSize: 13, lineHeight: 1.35 }}>{g.desc}</div>
            <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
              {g.tags.map(t => (
                <span key={t} style={{ fontSize: 12, padding: "4px 8px", borderRadius: 999, border: "1px solid rgba(0,0,0,.12)", opacity: 0.85 }}>
                  {t}
                </span>
              ))}
            </div>
            <div style={{ marginTop: 12 }}>
              <button
                type="button"
                onClick={() => launch(g.file)}
                style={{ padding: "10px 14px", borderRadius: 999, border: "1px solid rgba(0,0,0,.22)", background: "rgba(0,0,0,.04)", fontWeight: 900 }}
              >
                Launch
              </button>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 16, opacity: 0.75, fontSize: 12, lineHeight: 1.4 }}>
        Note: For seeded play, each game should include <code>{'<script src="wordiness-seed-bridge.js"></script>'}</code> in its HTML.
      </div>
    </div>
  );
}