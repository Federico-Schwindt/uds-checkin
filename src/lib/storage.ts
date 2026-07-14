import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Absolute directory where uploaded files (photos, signatures) are stored.
 * Set UPLOADS_DIR to a path OUTSIDE the deployment folder so redeploys don't
 * wipe customer photos/signatures (e.g. /home/user/uds-uploads on Hostinger).
 * Falls back to `.data/uploads` under the project for local development.
 */
export function uploadsDir(): string {
  return process.env.UPLOADS_DIR
    ? path.resolve(process.env.UPLOADS_DIR)
    : path.join(process.cwd(), ".data", "uploads");
}

/**
 * Stores an uploaded file (photo or signature) and returns a public URL.
 * - With BLOB_READ_WRITE_TOKEN (Vercel): uploads to Vercel Blob.
 * - Otherwise (Hostinger / any Node server): writes to UPLOADS_DIR, served by
 *   /api/files/[...path].
 */
export async function storeFile(buffer: Buffer, filename: string, contentType: string): Promise<string> {
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const key = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`;

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import("@vercel/blob");
    const blob = await put(`uploads/${key}`, buffer, { access: "public", contentType });
    return blob.url;
  }

  const dir = uploadsDir();
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, key), buffer);
  return `/api/files/${key}`;
}

/** Decode a canvas data URL (signatures) into a stored file URL. */
export async function storeDataUrl(dataUrl: string, name: string): Promise<string> {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match) return "";
  const [, contentType, b64] = match;
  const ext = contentType.split("/")[1]?.split("+")[0] || "png";
  return storeFile(Buffer.from(b64, "base64"), `${name}.${ext}`, contentType);
}
