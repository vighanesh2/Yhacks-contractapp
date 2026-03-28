import { NextResponse } from "next/server";

import { parseAndChunkContract } from "@/lib/rag-pipeline";

export const runtime = "nodejs";

const MAX_FILE_BYTES = 20 * 1024 * 1024;

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json(
      { error: "Expected multipart/form-data with a file field." },
      { status: 400 }
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: 'Missing file. Use form field name "file".' },
      { status: 400 }
    );
  }

  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json(
      { error: `File too large (max ${MAX_FILE_BYTES / (1024 * 1024)} MB).` },
      { status: 413 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const fileName = file.name || "upload";

  try {
    const { fullText, chunks } = await parseAndChunkContract(buffer, fileName);
    return NextResponse.json({
      fileName,
      textLength: fullText.length,
      chunkCount: chunks.length,
      chunks,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to process file.";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
