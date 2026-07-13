import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";

const TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  pdf: "application/pdf",
};

export async function GET(_req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await ctx.params;
  const name = segments.join("/");
  // Prevent path traversal
  if (name.includes("..") || name.includes("\\")) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  try {
    const filePath = path.join(process.cwd(), ".data", "uploads", name);
    const data = await readFile(filePath);
    const ext = name.split(".").pop()?.toLowerCase() || "";
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": TYPES[ext] || "application/octet-stream",
        "Cache-Control": "private, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
