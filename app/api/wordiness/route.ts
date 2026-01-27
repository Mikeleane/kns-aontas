import { NextResponse } from "next/server";
import { readdir } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

export async function GET() {
  const dir = path.join(process.cwd(), "public", "wordiness");
  const entries = await readdir(dir, { withFileTypes: true });

  const files = entries
    .filter((e) => e.isFile())
    .map((e) => e.name)
    .filter((n) => /\.(html|htm)$/i.test(n))
    .filter((n) => !n.startsWith("_"))
    .sort((a, b) => a.localeCompare(b));

  // return objects so we can add metadata later
  return NextResponse.json({
    files: files.map((name) => ({
      name,
      href: "/wordiness/" + name,
      id: name.replace(/\.(html|htm)$/i, ""),
    })),
  });
}
