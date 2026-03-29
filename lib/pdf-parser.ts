import pdf from "pdf-parse";
import mammoth from "mammoth";

export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  const data = await pdf(buffer);
  return data.text;
}

export async function extractTextFromDOCX(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

export function extractText(buffer: Buffer, fileName: string): Promise<string> {
  const ext = fileName.toLowerCase().split(".").pop();
  if (ext === "pdf") return extractTextFromPDF(buffer);
  if (ext === "docx" || ext === "doc") return extractTextFromDOCX(buffer);
  return Promise.reject(new Error("Unsupported file type"));
}
