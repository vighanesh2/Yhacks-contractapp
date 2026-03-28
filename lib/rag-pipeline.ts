import { chunkContract } from "./chunker";
import { extractText } from "./pdf-parser";

export type ParsedContractForRag = {
  fileName: string;
  fullText: string;
  chunks: ReturnType<typeof chunkContract>;
};

/**
 * End-to-end: binary upload → plain text → section-aware chunks for embeddings / retrieval.
 */
export async function parseAndChunkContract(
  buffer: Buffer,
  fileName: string
): Promise<ParsedContractForRag> {
  const fullText = await extractText(buffer, fileName);
  const chunks = chunkContract(fullText);
  return { fileName, fullText, chunks };
}
