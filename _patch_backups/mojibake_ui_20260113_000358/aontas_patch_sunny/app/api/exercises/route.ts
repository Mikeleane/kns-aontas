import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Aontas 10 (Kilgobnet N.S.)  -  /api/exercises
 *
 * Goal:
 * - Generate exercises for ONE class with TWO streams (Standard + Supported)
 * - Every item MUST share ONE answer key.
 *
 * Hard guardrails implemented in code:
 * - True/False statements are forced to be IDENTICAL across both streams (to protect shared answer key).
 * - Word study words are restricted to words that appear in BOTH texts (intersection list).
 */

type ExerciseSide = {
  prompt: string;
  options?: string[];
};

type ExerciseItem = {
  id: number;
  type: string;
  skill: string;
  standard: ExerciseSide;
  adapted: ExerciseSide;
  answer: string | string[] | number[];
};

type ExercisesResponse = {
  items: ExerciseItem[];
  error?: string;
  warning?: string;
};

type ErrorResponse = { error: string };

function safeJsonParse<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function clamp<T>(arr: T[], n: number) {
  return arr.slice(0, Math.max(0, n));
}

function sentences(text: string): string[] {
  const cleaned = String(text || "").replace(/\s+/g, " ").trim();
  if (!cleaned) return [];
  const parts = cleaned.match(/[^.!?]+[.!?]+|[^.!?]+$/g);
  return (parts || []).map((s) => s.trim()).filter(Boolean);
}

function tokens(text: string): string[] {
  const t = String(text || "").toLowerCase();
  const m = t.match(/\p{L}+(?:'\p{L}+)?/gu);
  return (m || []).map((w) => w.toLowerCase());
}

const STOPWORDS = new Set(
  [
    "the","and","a","an","to","of","in","on","for","with","is","are","was","were","be","been","being","as","at","by","from",
    "that","this","it","they","their","them","he","she","we","you","i","or","but","not","can","could","would","should","will",
    "just","so","if","than","then","about","into","over","after","before","more","most","some","any","all","many","much","very","also",
  ].map((s) => s.toLowerCase())
);

function topSharedWords(standardText: string, adaptedText: string, n = 20): string[] {
  const a = tokens(standardText);
  const b = new Set(tokens(adaptedText));
  const freq = new Map<string, number>();
  for (const w of a) {
    if (!b.has(w)) continue;
    if (w.length < 4) continue;
    if (STOPWORDS.has(w)) continue;
    freq.set(w, (freq.get(w) || 0) + 1);
  }
  return clamp(
    [...freq.entries()]
      .sort((x, y) => y[1] - x[1])
      .map(([w]) => w),
    n
  );
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Very lightweight syllable-ish chunking (heuristic, not a phonics oracle)
function syllableChunks(word: string): string {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return word;
  const vowels = new Set(["a", "e", "i", "o", "u", "y"]);
  const chunks: string[] = [];
  let buf = "";
  for (let i = 0; i < w.length; i++) {
    const ch = w[i];
    buf += ch;
    const next = w[i + 1];
    const isV = vowels.has(ch);
    const nextIsV = next ? vowels.has(next) : false;
    if (isV && !nextIsV) {
      if (buf.length) {
        chunks.push(buf);
        buf = "";
      }
    }
  }
  if (buf) chunks.push(buf);
  if (chunks.length > 2 && chunks[0].length === 1) {
    chunks[1] = chunks[0] + chunks[1];
    chunks.shift();
  }
  return chunks.join("-");
}

function normalizeBlocks(rawBlocks: any[]): string[] {
  const out = rawBlocks.map((b) => String(b || "").trim()).filter(Boolean);

  // UI ids (current)
  const map: Record<string, string> = {
    gist_main: "gist_main_idea",
    detail: "detail_questions",
    vocabulary: "vocabulary",
    true_false: "true_false",
    cloze_gapfill: "cloze_gapfill",
    ordering: "ordering",
    word_study: "word_study",
  };

  // Already-normalized ids are allowed too
  return out.map((id) => map[id] || id);
}

/* ------------------------ True/False hardening ------------------------ */

function extractNumberedStatements(prompt: string): string[] {
  const lines = String(prompt || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const stmts: string[] = [];
  for (const l of lines) {
    // 1) ...  OR  1. ...  OR  - ...
    const m = l.match(/^(\d+)[\)\.]\s+(.*)$/);
    if (m && m[2]) stmts.push(m[2].trim());
  }
  if (stmts.length) return stmts;

  // fallback: try bullet lines
  const bullets = lines
    .filter((l) => /^[-•]\s+/.test(l))
    .map((l) => l.replace(/^[-•]\s+/, "").trim())
    .filter(Boolean);
  return bullets;
}

function buildTrueFalseItem(args: {
  id: number;
  statements: string[];
  answers: ("True" | "False")[];
}): ExerciseItem {
  const numbered = args.statements.map((s, i) => `${i + 1}) ${s}`).join("\n");
  return {
    id: args.id,
    type: "trueFalse",
    skill: "True / False",
    standard: {
      prompt: `Decide if each statement is True or False:\n${numbered}`,
      options: ["True", "False"],
    },
    adapted: {
      prompt: `True or False? Tick one.\n${numbered}`,
      options: ["True", "False"],
    },
    answer: args.answers,
  };
}

function deterministicTrueFalse(args: {
  id: number;
  standardText: string;
  adaptedText: string;
  sharedWords: string[];
}): ExerciseItem {
  // Two true, two false. Keep it safe and objective.
  const shared = args.sharedWords.filter((w) => w.length >= 4).slice(0, 6);
  const ents =
    (args.standardText.match(/\b[A-Z][a-z]{2,}\b/g) || [])
      .filter((w) => !["The", "This", "That", "After", "When", "While"].includes(w))
      .slice(0, 6);

  const trueStmt1 = shared[0] ? `The text includes the word "${shared[0]}".` : `The text describes a real situation.`;
  const trueStmt2 = ents[0] ? `The text mentions "${ents[0]}".` : shared[1] ? `The text includes the word "${shared[1]}".` : `The text gives details about the topic.`;

  const falseStmt1 = `The text says the story is set on Mars.`;
  const falseStmt2 = `The text says the main topic is unicorns.`;

  const statements = [trueStmt1, trueStmt2, falseStmt1, falseStmt2];
  const answers: ("True" | "False")[] = ["True", "True", "False", "False"];
  return buildTrueFalseItem({ id: args.id, statements, answers });
}

/* ------------------------ Word study hardening ------------------------ */

function pickWordStudyWords(sharedWords: string[]): string[] {
  const picks = sharedWords
    .filter((w) => w.length >= 5 && /^[a-z]+$/i.test(w))
    .slice(0, 4);
  return picks.length ? picks : clamp(sharedWords.filter((w) => w.length >= 4), 4);
}

function buildWordStudyItem(args: { id: number; sharedWords: string[] }): ExerciseItem {
  const picks = pickWordStudyWords(args.sharedWords);
  const breakdowns = picks.map((w) => `${w} - ${syllableChunks(w)}`);

  const wordList = picks.length ? picks.join(", ") : "(choose 4 shared words from the text)";
  return {
    id: args.id,
    type: "wordStudy",
    skill: "Word study (break down words)",
    standard: {
      prompt:
        "Break down each word. Add hyphens for syllable-like chunks, and circle any prefix/suffix you notice.\n\nWords: " +
        wordList,
    },
    adapted: {
      prompt:
        "Break down each word using hyphens. Tip: clap the parts as you say the word.\n\nWords: " +
        wordList,
    },
    answer: breakdowns,
  };
}

/* ----------------------------- Fallback mode ----------------------------- */

function fallbackExercises(args: {
  standardText: string;
  adaptedText: string;
  blocks: string[];
  questionFocus?: string;
  schoolClass?: number;
  stage?: number;
}): ExercisesResponse {
  const { standardText, adaptedText, blocks } = args;
  const wants = new Set(blocks.map((b) => String(b)));
  const sharedWords = topSharedWords(standardText, adaptedText, 24);
  const sents = sentences(standardText);

  let id = 1;
  const items: ExerciseItem[] = [];

  if (wants.has("gist_main_idea")) {
    const first = sents[0] || "The text explains the topic and gives key details.";
    const second = sents[1] ? " " + sents[1] : "";
    const ans = ("Sample answer: " + first + second).slice(0, 280);

    items.push({
      id: id++,
      type: "gist",
      skill: "Main idea",
      standard: { prompt: "In 1-2 sentences, what is the main idea of the text?" },
      adapted: { prompt: "In 1 sentence, what is the text mostly about? Start with: \"This text is about...\"" },
      answer: ans,
    });
  }

  if (wants.has("detail_questions")) {
    const pick = clamp(sents, 3);
    const ans = pick.length ? `Sample answers (from the text):\n- ${pick.join("\n- ")}` : "Sample answers: Use details from the text.";
    items.push({
      id: id++,
      type: "detail",
      skill: "Key details",
      standard: { prompt: "Find 3 key details from the text. Write them as short bullet points." },
      adapted: { prompt: "Find 3 key details. Use starters: \"One detail is...\", \"Another detail is...\", \"A third detail is...\"." },
      answer: ans,
    });
  }

  if (wants.has("vocabulary")) {
    const words = clamp(sharedWords, 6);
    const ans = words.length ? `Words (from both texts): ${words.join(", ")}` : "Words: (choose 6 shared words from the text).";
    items.push({
      id: id++,
      type: "vocab",
      skill: "Vocabulary (shared words)",
      standard: { prompt: "Choose 6 words that appear in BOTH texts. For each: copy the sentence + write a meaning." },
      adapted: { prompt: "Find these shared words in the text and write a short meaning (or draw a symbol): " + (words.length ? words.join(", ") : "(teacher chooses)") + "." },
      answer: ans,
    });
  }

  if (wants.has("true_false")) {
    items.push(deterministicTrueFalse({ id: id++, standardText, adaptedText, sharedWords }));
  }

  if (wants.has("cloze_gapfill")) {
    const base = sents.length ? sents[Math.min(2, sents.length - 1)] : standardText;
    const blanks = clamp(sharedWords, 5);
    let cloze = base;
    const answers: string[] = [];
    for (const w of blanks) {
      const re = new RegExp(`\\b${w}\\b`, "i");
      if (re.test(cloze)) {
        cloze = cloze.replace(re, "_____");
        answers.push(w);
      }
    }
    items.push({
      id: id++,
      type: "cloze",
      skill: "Cloze / gap-fill",
      standard: { prompt: "Complete the sentence by filling the gaps. Use the word bank.\n\n" + cloze + "\n\nWord bank: " + answers.join(", ") },
      adapted: { prompt: "Fill in the gaps using the word bank.\n\n" + cloze + "\n\nWord bank: " + answers.join(", ") },
      answer: answers,
    });
  }

  if (wants.has("ordering")) {
    const pick = clamp(sents.slice(0, 6), 4);
    const correct = pick.length ? pick : ["First...", "Then...", "Next...", "Finally..."];
    const shuffled = shuffle(correct);
    items.push({
      id: id++,
      type: "ordering",
      skill: "Ordering",
      standard: { prompt: "Put these events/ideas in the correct order (1-4):\n" + shuffled.map((x, i) => `${i + 1}) ${x}`).join("\n") },
      adapted: { prompt: "Number the sentences in the correct order (1-4):\n" + shuffled.map((x, i) => `${i + 1}) ${x}`).join("\n") },
      answer: correct,
    });
  }

  if (wants.has("word_study")) {
    items.push(buildWordStudyItem({ id: id++, sharedWords }));
  }

  return { items, warning: "NO_API_KEY_CONFIGURED" };
}

/* --------------------------- Post-process guard --------------------------- */

function sanitizeItems(args: {
  items: ExerciseItem[];
  standardText: string;
  adaptedText: string;
  sharedWords: string[];
}): { items: ExerciseItem[]; warning?: string } {
  let warn: string[] = [];
  let id = 1;

  const out: ExerciseItem[] = [];
  const seenSingleton = new Set<string>();

  const canonicalType = (t: string) => {
    if (t === "word_study") return "wordStudy";
    if (t === "true_false") return "trueFalse";
    if (t === "cloze_gapfill") return "cloze";
    return t;
  };

  const isSingleton = (t: string) => {
    return ["wordStudy", "trueFalse", "cloze", "ordering", "gist"].includes(t);
  };


  for (const raw of args.items || []) {
    const type = String(raw.type || "").trim() || "detail";
    const canon = canonicalType(type);
    if (isSingleton(canon)) {
      if (seenSingleton.has(canon)) {
        warn.push(`${canon}_deduped`);
        continue;
      }
      seenSingleton.add(canon);
    }


    // Force sequential ids (stable teacher keys)
    const item: ExerciseItem = { ...raw, id: id++ } as any;

    // Ensure fields exist
    item.standard = item.standard || { prompt: "" };
    item.adapted = item.adapted || { prompt: "" };

    // ---- True/False: statements must be IDENTICAL across versions ----
    if (type === "trueFalse" || type === "true_false") {
      const stdPromptRaw = String(item.standard.prompt || "").trim();

      // Case A (common): one statement per item.
      // The STATEMENT must be identical across Standard and Supported.
      let stmts = extractNumberedStatements(stdPromptRaw);

      // Sometimes the model puts the statements in a top-level `options` array.
      // If so, treat those as the statements (NOT the True/False choices).
      if (!stmts.length) {
        const top = (item as any).options;
        if (Array.isArray(top)) {
          const cleaned = top.map((x: any) => String(x || "").trim()).filter(Boolean);
          const looksLikeTFChoices =
            cleaned.length === 2 && cleaned.every((s: string) => /^(true|false)$/i.test(s));
          if (!looksLikeTFChoices && cleaned.length >= 2) {
            stmts = cleaned;
          }
        }
      }

      if (!stmts.length) {
        const statement = stdPromptRaw
          .replace(/^true\s*\/\s*false\s*[:\-]\s*/i, "")
          .replace(/^true\s+or\s+false\s*[:\-]\s*/i, "")
          .trim();

        const looksLikeInstruction = /statement|statements|decide|tick|true\s*or\s*false|true\s*\/\s*false/i.test(statement);

        if (!statement || looksLikeInstruction) {
          warn.push("true_false_repaired");
          out.push(
            deterministicTrueFalse({
              id: item.id,
              standardText: args.standardText,
              adaptedText: args.adaptedText,
              sharedWords: args.sharedWords,
            })
          );
          continue;
        }

        // Force identical statement and identical options
        item.standard.prompt = statement;
        item.adapted.prompt = statement;
        item.standard.options = item.standard.options?.length ? item.standard.options : ["True", "False"];
        item.adapted.options = item.standard.options;
        stmts = [statement];

        // Normalise answer to a single "True"/"False"
        if (Array.isArray(item.answer)) {
          const first = item.answer[0];
          item.answer = String(first || "").toLowerCase().startsWith("t") ? "True" : "False";
        } else if (typeof item.answer === "string") {
          item.answer = item.answer.toLowerCase().startsWith("t") ? "True" : "False";
        } else {
          warn.push("true_false_repaired");
          out.push(
            deterministicTrueFalse({
              id: item.id,
              standardText: args.standardText,
              adaptedText: args.adaptedText,
              sharedWords: args.sharedWords,
            })
          );
          continue;
        }

    // ---- Cloze: keep word bank consistent with answer key ----
    if (canon === "cloze" || type === "cloze") {
      const answers = Array.isArray(item.answer)
        ? (item.answer as any[]).map((x) => String(x || "").trim()).filter(Boolean)
        : [];

      const fixBank = (p: string) => {
        const s = String(p || "");
        if (!answers.length) return s;
        if (/word\s*bank\s*:/i.test(s)) {
          return s.replace(/(word\s*bank\s*:).*/i, `$1 ${answers.join(", ")}`);
        }
        // If no explicit bank line, append one (Supported and Standard must match).
        return `${s}\n\nWord bank: ${answers.join(", ")}`;
      };

      item.standard.prompt = fixBank(String(item.standard.prompt || ""));
      item.adapted.prompt = fixBank(String(item.adapted.prompt || ""));
    }

        out.push(item);
        continue;
      }

      // Case B: a single item contains multiple numbered statements in the prompt
      const ans = item.answer;

      if (!Array.isArray(ans) || ans.length !== stmts.length) {
        warn.push("true_false_repaired");
        out.push(
          deterministicTrueFalse({
            id: item.id,
            standardText: args.standardText,
            adaptedText: args.adaptedText,
            sharedWords: args.sharedWords,
          })
        );
        continue;
      }

      const normAns: ("True" | "False")[] = ans.map((x) =>
        String(x).toLowerCase().startsWith("t") ? "True" : "False"
      ) as any;

      out.push(buildTrueFalseItem({ id: item.id, statements: stmts, answers: normAns }));
      continue;
    }

// ---- Word study: must use shared words only ----
    if (type === "wordStudy" || type === "word_study") {
      // Always rebuild word study from shared list (so it can't drift)
      warn.push("word_study_rebuilt");
      out.push(buildWordStudyItem({ id: item.id, sharedWords: args.sharedWords }));
      continue;
    }

    out.push(item);
  }

  return { items: out, warning: warn.length ? [...new Set(warn)].join(",") : undefined };
}

/* -------------------------------- Handler -------------------------------- */


function addSupportedAliases(resp: any) {
  if (!resp || !Array.isArray(resp.items)) return resp;
  return {
    ...resp,
    items: resp.items.map((it: any) => ({
      ...it,
      SUPPORTED: it.SUPPORTED || it.adapted,
      adapted: it.adapted || it.SUPPORTED,
    })),
  };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const standardText: string = body.standardText || body.standardOutput || body.standard || "";
    const adaptedText: string =
      body.adaptedText ||
      body.adaptedOutput ||
      body.adapted ||
      body.SUPPORTEDText ||
      body.SUPPORTEDOutput ||
      body.SUPPORTED ||
      "";

    const outputLanguage: string = body.outputLanguage || body.language || "English";
    const outputType: string = body.textType || body.outputType || "Article";
    const questionFocus: string = body.questionFocus || "Balanced comprehension";

    const schoolClass: number | undefined = Number.isFinite(body.schoolClass) ? Number(body.schoolClass) : undefined;
    const stage: number | undefined = Number.isFinite(body.stage) ? Number(body.stage) : undefined;

    const rawBlocks =
      (Array.isArray(body.blocks) && body.blocks) ||
      (Array.isArray(body.selectedBlocks) && body.selectedBlocks) ||
      [];

    const enabledBlocks: string[] = rawBlocks.length
      ? normalizeBlocks(rawBlocks)
      : ["gist_main_idea", "detail_questions", "vocabulary"];

    const sharedWords = topSharedWords(standardText, adaptedText, 30);

    // Fallback mode (lets you test the full pipeline without keys)
    if (!process.env.OPENAI_API_KEY) {
      const fb = fallbackExercises({
          standardText,
          adaptedText,
          blocks: enabledBlocks,
          questionFocus,
          schoolClass,
          stage,
        });
      return NextResponse.json(addSupportedAliases(fb));
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const modelName = process.env.OPENAI_MODEL || "gpt-4.1-mini";

    const prompt = `
You are an expert Irish primary-school teacher designing a reading lesson for ONE class with TWO streams:
- Student A: STANDARD
- Student B: SUPPORTED (same learning target, more accessible presentation)

CRITICAL RULES:
- The class works together: every exercise MUST share ONE single answer key.
- Standard and Supported can have different scaffolds, but answers must match.
- Do not oversimplify Supported: keep the same learning target.
- Output language: ${outputLanguage}
- Text type: ${outputType}
- Class/Stage context: Class ${schoolClass ?? "n/a"}, Stage ${stage ?? "n/a"}
- Question focus: ${questionFocus}

TEXTS:
STANDARD:
"""
${standardText}
"""

SUPPORTED:
"""
${adaptedText}
"""

SHARED WORD LIST (words that appear in BOTH texts):
${sharedWords.slice(0, 24).map((w) => `- ${w}`).join("\n")}

EXERCISE BLOCKS TO GENERATE:
${enabledBlocks.map((b) => `- ${b}`).join("\n")}

HARD CONSTRAINTS:
1) TRUE/FALSE:
   - The STATEMENTS must be IDENTICAL in Standard and Supported.
   - Only the instruction line may differ.
   - The answer must be an array like ["True","False","True",...], one per statement.
2) WORD STUDY:
   - Only choose words from the SHARED WORD LIST above.
   - Use the SAME words in Standard and Supported.
3) Prefer using shared words for vocabulary tasks too (so the whole class targets the same words).

RETURN:
Return valid JSON ONLY (no markdown) exactly:
{
  "items": [
    {
      "id": 1,
      "type": "gist|detail|vocab|trueFalse|cloze|ordering|wordStudy",
      "skill": "...",
      "standard": { "prompt": "...", "options": ["..."]? },
      "adapted": { "prompt": "...", "options": ["..."]? },
      "answer": "..." OR ["...", "..."] OR [0,1,2]
    }
  ]
}

BLOCK GUIDANCE:
- gist_main_idea: 1-2 items on main idea / headline / summary.
- detail_questions: 3-5 items that require evidence from the text.
- vocabulary: 2-4 items, in-context meaning, matching, or using words in sentences (prefer shared words).
- true_false: 3-5 statements; STATEMENTS identical across both versions; Supported can have simpler instruction.
- cloze_gapfill: 1-2 cloze tasks. Use the SAME missing words/answers in both versions; Supported can include a word bank.
- ordering: 1 item ordering events/steps. Supported can provide clearer layout.
- word_study: 1-2 items breaking down shared words (syllables/prefix/suffix/word families). Only shared words.

QUALITY:
- Do not invent facts.
- Keep it printable.
- Ensure every item has a clear answer.
`.trim();

    const completion = await client.chat.completions.create({
      model: modelName,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.55,
      max_tokens: 1800,
    });

    const content = completion.choices[0]?.message?.content?.trim() || "";
    const parsed = safeJsonParse<ExercisesResponse>(content);

    if (!parsed || !Array.isArray(parsed.items)) {
      return NextResponse.json({ error: "Failed to parse exercises JSON." } satisfies ErrorResponse, { status: 500 });
    }

    const sanitized = sanitizeItems({
      items: parsed.items as any,
      standardText,
      adaptedText,
      sharedWords,
    });

    return NextResponse.json(
      addSupportedAliases({
        items: sanitized.items,
        warning: sanitized.warning,
      } satisfies ExercisesResponse)
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Exercises generation failed." } satisfies ErrorResponse,
      { status: 500 }
    );
  }
}