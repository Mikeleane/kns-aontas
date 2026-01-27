"use client";

import React, { useEffect, useMemo, useState } from "react";

type Game = { name: string; href: string; id: string };
type ApiResponse = { files: Game[] };

function titleFromId(id: string) {
  // e.g. "wordiness-word-stress-dj-remix" -> "Word Stress DJ Remix"
  const cleaned = id
    .replace(/^wordiness-/, "")
    .replace(/[-_]+/g, " ")
    .trim();
  return cleaned
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
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
  setTimeout(() => URL.revokeObjectURL(url), 400);
}

async function downloadRaw(url: string, filename: string) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch: " + url);
  const html = await res.text();
  downloadTextFile(filename, html);
}

async function downloadSeededTemplate(opts: {
  templateUrl: string;
  filename: string;
  seedText: string;
}) {
  const res = await fetch(opts.templateUrl, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch template: " + opts.templateUrl);
  let html = await res.text();

  const seedJson = JSON.stringify(opts.seedText || "");

  const inject = [
    "<script>",
    "(function(){",
    "  try{",
    "    var seed = " + seedJson + ";",
    "    var ta = document.querySelector('#input');",
    "    if(ta && seed && String(seed).trim()){",
    "      ta.value = String(seed).replace(/\\r/g,'');",
    "      if(typeof window.render === 'function') window.render();",
    "      else if(typeof render === 'function') render();",
    "    }",
    "  }catch(e){}",
    "})();",
    "</script>",
    ""
  ].join("\\n");

  if (html.includes("</body>")) html = html.replace("</body>", inject + "</body>");
  else html += inject;

  downloadTextFile(opts.filename, html);
}

export default function WordinessHub() {
  const [games, setGames] = useState<Game[]>([]);
  const [err, setErr] = useState<string>("");
  const [seed, setSeed] = useState(
    "re-spon-si-bi-li-ty\\n" +
      "in-for-ma-tion\\n" +
      "op-por-tu-ni-ty\\n" +
      "dif-fi-cult\\n" +
      "in-ter-est-ing\\n" +
      "a-ma-zing"
  );

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/wordiness", { cache: "no-store" });
        const data = (await res.json()) as ApiResponse;
        setGames(data.files || []);
      } catch (e: any) {
        setErr(e?.message || String(e));
      }
    })();
  }, []);

  const seedHash = useMemo(() => {
    const s = seed.trim();
    return s ? "#seed=" + encodeURIComponent(s) : "";
  }, [seed]);

  function isSyllableGame(g: Game) {
    const n = (g.id || "").toLowerCase();
    return n.includes("syllable") && n.includes("tiles");
  }

  return (
    <main style={{ maxWidth: 1050, margin: "0 auto", padding: 16, fontFamily: "system-ui" }}>
      <h1 style={{ margin: "6px 0 6px" }}>Wordiness</h1>
      <p style={{ margin: 0, opacity: 0.8 }}>
        Your Wordiness games in <code>/public/wordiness</code>, now hooked into Aontas.
      </p>

      <section
        style={{
          marginTop: 16,
          border: "1px solid rgba(255,255,255,.14)",
          borderRadius: 14,
          padding: 14,
        }}
      >
        <h2 style={{ margin: "0 0 8px" }}>Seed text (used by Syllable Tiles)</h2>
        <p style={{ margin: "0 0 10px", opacity: 0.85 }}>
          One word per line. Mark syllables with <b>-</b> or <b>·</b>.
        </p>
        <textarea
          value={seed}
          onChange={(e) => setSeed(e.target.value)}
          rows={6}
          style={{
            width: "100%",
            padding: 12,
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,.14)",
            background: "rgba(0,0,0,.20)",
            color: "inherit",
          }}
        />
      </section>

      {err ? (
        <p style={{ marginTop: 14, color: "#ff9090" }}>Error: {err}</p>
      ) : null}

      <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12 }}>
        {games.map((g) => {
          const title = titleFromId(g.id);
          const syllable = isSyllableGame(g);

          return (
            <div
              key={g.name}
              style={{
                border: "1px solid rgba(255,255,255,.14)",
                borderRadius: 14,
                padding: 14,
                background: "rgba(0,0,0,.10)",
              }}
            >
              <div style={{ fontWeight: 900, fontSize: 18 }}>{title}</div>
              <div style={{ opacity: 0.75, fontSize: 13, marginTop: 6 }}>{g.name}</div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
                <a
                  href={g.href + (syllable ? seedHash : "")}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: "1px solid rgba(255,255,255,.14)",
                    textDecoration: "none",
                    color: "inherit",
                  }}
                >
                  Open
                </a>

                {syllable ? (
                  <button
                    onClick={() =>
                      downloadSeededTemplate({
                        templateUrl: g.href,
                        filename: g.name.replace(/\.(html|htm)$/i, "") + "-seeded.html",
                        seedText: seed,
                      })
                    }
                    style={{
                      padding: "10px 12px",
                      borderRadius: 12,
                      border: "1px solid rgba(56,189,248,.40)",
                      background: "rgba(56,189,248,.12)",
                      color: "inherit",
                      cursor: "pointer",
                    }}
                  >
                    Download seeded
                  </button>
                ) : (
                  <button
                    onClick={() => downloadRaw(g.href, g.name)}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 12,
                      border: "1px solid rgba(255,255,255,.14)",
                      background: "rgba(255,255,255,.04)",
                      color: "inherit",
                      cursor: "pointer",
                    }}
                  >
                    Download
                  </button>
                )}
              </div>

              {syllable ? (
                <div style={{ marginTop: 10, opacity: 0.75, fontSize: 13 }}>
                  This one gets seeded via <code>#seed=...</code> (Open) or embedded (Download seeded).
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </main>
  );
}
