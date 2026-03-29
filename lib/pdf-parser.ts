import path from "node:path";
import { pathToFileURL } from "node:url";

import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";

let pdfWorkerConfigured = false;

/**
 * pdf.js resolves the worker with dynamic import(workerSrc). After Turbopack bundles
 * pdfjs-dist, the default worker path points into `.next/` and fails. Point at the
 * real file in node_modules (see also serverExternalPackages in next.config.ts).
 */
function ensurePdfJsWorker(): void {
  if (pdfWorkerConfigured) return;
  const workerFile = path.join(
    process.cwd(),
    "node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"
  );
  PDFParse.setWorker(pathToFileURL(workerFile).href);
  pdfWorkerConfigured = true;
}

export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  ensurePdfJsWorker();
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return (result.text ?? "").trim();
  } finally {
    await parser.destroy();
  }
}

export async function extractTextFromDOCX(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return (result.value ?? "").trim();
}

export function extractText(buffer: Buffer, fileName: string): Promise<string> {
  const ext = fileName.toLowerCase().split(".").pop();
  if (ext === "pdf") return extractTextFromPDF(buffer);
  if (ext === "docx" || ext === "doc") return extractTextFromDOCX(buffer);
  return Promise.reject(new Error("Unsupported file type"));
}
