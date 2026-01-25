import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Aontas 10 (Kilgobnet N.S.) — /api/adapt
 * Creates TWO versions of the same reading text:
 *  - STANDARD (Student A)
 *  - SUPPORTED (Student B) — same learning target, clearer layout and language supports
 *
 * Irish Primary context: Teachers choose Class/Stage (not CEFR).
 * Back-compat: accepts legacy `level` if older UI sends it.
 */

type AdaptRequestBody = {
  inputText: string;
  outputLanguage: string;

  // UI naming (preferred)
  textType?: string; // "Article" | "News report" | ...
  outputType?: string; // back-compat alias for textType

  schoolClass?: number; // 1..6
  stage?: number; // 1..4

  dyslexiaFriendly?: boolean;

  // legacy (do not require)
  level?: string;
};

type ModelResult = { standard: string; adapted: string };

type LengthTargets = {
  standardMin: number;
  standardMax: number;
  adaptedMin: number;
  adaptedMax: number;
};

function stageFromClass(c: number): number {
  if (!Number.isFinite(c)) return 4;
  if (c <= 2) return 2;
  if (c <= 4) return 3;
  return 4;
}

/**
 * Word-length targets tuned roughly by Irish Primary stage.
 * (These are teacher-facing tuning targets, not a claim about learners.)
 */
function getStageLengthTargets(stage: number): LengthTargets {
  switch (Number(stage) || 4) {
    case 1: // infants (future-proof)
      return { standardMin: 80, standardMax: 150, adaptedMin: 70, adaptedMax: 130 };
    case 2: // 1st/2nd
      return { standardMin: 180, standardMax: 320, adaptedMin: 150, adaptedMax: 280 };
    case 3: // 3rd/4th
      return { standardMin: 300, standardMax: 520, adaptedMin: 260, adaptedMax: 460 };
    case 4: // 5th/6th
    default:
      return { standardMin: 450, standardMax: 850, adaptedMin: 380, adaptedMax: 760 };
  }
}

function simpleFallbackAdaptation(args: {
  inputText: string;
  outputLanguage: string;
  outputType: string;
  schoolClass?: number;
  stage?: number;
  dyslexiaFriendly?: boolean;
  reason: string;
}) {
  const { inputText, outputLanguage, outputType, schoolClass, stage, dyslexiaFriendly, reason } = args;

  const header = `STANDARD VERSION (fallback — ${reason})`;
  const adaptedHeader = dyslexiaFriendly
    ? `SUPPORTED VERSION (fallback — ${reason}, extra spacing & reduced cognitive load)`
    : `SUPPORTED VERSION (fallback — ${reason}, reduced cognitive load)`;

  const meta = [
    `Language: ${outputLanguage}`,
    schoolClass ? `Class: ${schoolClass}` : null,
    stage ? `Stage: ${stage}` : null,
    `Text type: ${outputType}`,
  ].filter(Boolean);

  const standardOutput = [header, ...meta, "", String(inputText || "").trim()].join("\n");

  const adaptedBody = String(inputText || "")
    .trim()
    // paragraph every sentence-ish
    .split(/(?<=[.!?])\s+/)
    .join("\n\n");

  const adaptedOutput = [adaptedHeader, ...meta, "", adaptedBody].join("\n");

  return { standardOutput, adaptedOutput };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AdaptRequestBody;

    const inputText = String(body.inputText || "");
    const outputLanguage = String(body.outputLanguage || "English");
    const outputType = String(body.textType || body.outputType || "Article");
    const schoolClass = Number.isFinite(body.schoolClass) ? Number(body.schoolClass) : undefined;

    const stage =
      Number.isFinite(body.stage) ? Number(body.stage) : schoolClass ? stageFromClass(schoolClass) : 4;

    const dyslexiaFriendly = !!body.dyslexiaFriendly;

    if (!inputText.trim()) {
      return NextResponse.json({ error: "Missing inputText." }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    const modelName = process.env.OPENAI_MODEL || "gpt-4.1-mini";

    const inputWordCount = inputText.trim().length ? inputText.trim().split(/\s+/).length : 0;

    const targets = getStageLengthTargets(stage);

    if (!apiKey) {
      const { standardOutput, adaptedOutput } = simpleFallbackAdaptation({
        inputText,
        outputLanguage,
        outputType,
        schoolClass,
        stage,
        dyslexiaFriendly,
        reason: "NO_API_KEY_CONFIGURED",
      });
      return NextResponse.json({ standardOutput, adaptedOutput, warning: "NO_API_KEY_CONFIGURED" });
    }

    const client = new OpenAI({ apiKey });

    const systemPrompt = `
You are Aontas 10 (Kilgobnet N.S.), an assistant that adapts classroom reading texts for ONE class with TWO streams:

1) STANDARD (Student A)
2) SUPPORTED (Student B)

CRITICAL RULES (NON-NEGOTIABLE):
- SAME learning target in both versions.
- SAME key facts, names, numbers, and domain concepts.
- Do NOT “make it easier by changing the goal”.
- Keep important vocabulary aligned across both versions so the class can share ONE answer key.
  - If a word is difficult, KEEP the original word and add a simple gloss in parentheses the first time it appears.
    Example: “prematurely (born early)”.
  - Do not replace key words with simpler synonyms if that would break shared vocabulary.
- Remove web clutter (READ MORE, navigation labels, wire credits, stray site labels, +1, etc.).

SUPPORTED VERSION supports access by:
- shorter sentences and clearer paragraphing
- headings where helpful
- explicit connectors (because, so, however, as a result)
- bullet points for lists/steps
- an overview (1–2 sentences) at the start: what the whole text is about

DYSLEXIA SUPPORT:
If requested, make the SUPPORTED version highly readable:
- short paragraphs, clear headings, no dense blocks
- consistent phrasing; avoid unnecessary synonyms
- keep visual simplicity (no huge complex sentences)

OUTPUT:
Return ONLY valid JSON:
{
  "standard": "....",
  "adapted": "...."
}
`;

    const userPrompt = `
INPUT TEXT:
"""${inputText}"""

Approx original length: ~${inputWordCount} words.

Context (Irish Primary):
- Class: ${schoolClass ?? "n/a"}
- Stage: ${stage}

Requested language: ${outputLanguage}
Text type/genre: ${outputType}
Dyslexia-friendly: ${dyslexiaFriendly ? "yes" : "no"}

Target lengths (approx):
- STANDARD: ${targets.standardMin}–${targets.standardMax} words
- SUPPORTED: ${targets.adaptedMin}–${targets.adaptedMax} words

TASK:
1) Write the STANDARD version (within target length).
2) Write the SUPPORTED version (same target, clearer structure and supports; may be a bit shorter but must keep key ideas and vocabulary aligned).

Remember: if you simplify vocabulary, keep the original word and add a gloss in parentheses — do NOT swap it out entirely.
Return JSON only.
`;

    const completion = await client.chat.completions.create({
      model: modelName,
      temperature: 0.4,
      max_tokens: 2200,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt.trim() },
        { role: "user", content: userPrompt.trim() },
      ],
    });

    const content = completion.choices[0]?.message?.content?.trim() || "";
    let parsed: ModelResult | null = null;

    try {
      parsed = JSON.parse(content) as ModelResult;
    } catch {
      parsed = null;
    }

    if (!parsed?.standard || !parsed?.adapted) {
      const { standardOutput, adaptedOutput } = simpleFallbackAdaptation({
        inputText,
        outputLanguage,
        outputType,
        schoolClass,
        stage,
        dyslexiaFriendly,
        reason: "PARSE_ERROR",
      });
      return NextResponse.json(
        {
          standardOutput,
          adaptedOutput,
          warning: "Could not parse AI JSON — returned fallback.",
        },
        { status: 200 }
      );
    }

    return NextResponse.json({
      standardOutput: parsed.standard,
      adaptedOutput: parsed.adapted,
    });
  } catch (error) {
    console.error("Error in /api/adapt:", error);
    return NextResponse.json({ error: "Something went wrong processing the request." }, { status: 500 });
  }
}
