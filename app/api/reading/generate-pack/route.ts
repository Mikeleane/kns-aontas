

function normAnswer(s: any) {
  return String(s ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[“”]/g, '"')
    .replace(/[’]/g, "'")
    .toLowerCase();
}

function fixMcqAnswerIndexes(obj: any): any {
  if (!obj || typeof obj !== "object") return obj;

  // If this looks like an MCQ item: { options: [...], answer: "...", answerIndex?: number }
  if (Array.isArray(obj.options) && typeof obj.answer === "string") {
    const a = normAnswer(obj.answer);
    const idx = obj.options.findIndex((opt: any) => normAnswer(opt) === a);
    if (idx >= 0) obj.answerIndex = idx;
  }

  // Recurse arrays/objects
  if (Array.isArray(obj)) {
    obj.forEach((x) => fixMcqAnswerIndexes(x));
  } else {
    Object.keys(obj).forEach((k) => fixMcqAnswerIndexes(obj[k]));
  }
  return obj;
}

