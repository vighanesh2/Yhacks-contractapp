import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";

export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  try {
    const textResult = await parser.getText();
    return textResult.text;
  } finally {
    await parser.destroy();
  }
}

export async function extractTextFromDOCX(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

export async function extractText(
  buffer: Buffer,
  fileName: string
): Promise<string> {
  const ext = fileName.toLowerCase().split(".").pop();
  if (ext === "pdf") {
    return extractTextFromPDF(buffer);
  }
  if (ext === "docx") {
    return extractTextFromDOCX(buffer);
  }
  if (ext === "doc") {
    throw new Error(
      "Legacy .doc is not supported. Convert the file to .docx or PDF and upload again."
    );
  }
  throw new Error(`Unsupported file type: .${ext ?? "unknown"}`);
}
