import { mkdir, writeFile } from "fs/promises";
import path from "path";

const STORAGE_ROOT = path.join(process.cwd(), "storage", "uploads");

export const MAX_STEP_FILE_SIZE_BYTES = 50 * 1024 * 1024;
export const ACCEPTED_STEP_EXTENSIONS = new Set([".step", ".stp"]);

export function hasAcceptedStepExtension(fileName: string) {
  const extension = path.extname(fileName).toLowerCase();
  return ACCEPTED_STEP_EXTENSIONS.has(extension);
}

export function toSafeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export async function persistUpload(fileName: string, bytes: Uint8Array) {
  await mkdir(STORAGE_ROOT, { recursive: true });

  const stampedName = `${Date.now()}-${toSafeFileName(fileName)}`;
  const absolutePath = path.join(STORAGE_ROOT, stampedName);

  await writeFile(absolutePath, bytes);

  return {
    absolutePath,
    relativePath: path.join("storage", "uploads", stampedName),
  };
}
