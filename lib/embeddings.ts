import { Lava } from "@lavapayments/nodejs";

const lava = new Lava();

const OPENAI_EMBEDDINGS_URL = "https://api.openai.com/v1/embeddings";

type EmbeddingsCreateResponse = {
  data: Array<{ embedding: number[]; index?: number }>;
};

export async function embedText(text: string): Promise<number[]> {
  const data = (await lava.gateway(OPENAI_EMBEDDINGS_URL, {
    body: {
      model: "text-embedding-3-small",
      input: text,
    },
  })) as EmbeddingsCreateResponse;

  return data.data[0].embedding;
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }

  const data = (await lava.gateway(OPENAI_EMBEDDINGS_URL, {
    body: {
      model: "text-embedding-3-small",
      input: texts,
    },
  })) as EmbeddingsCreateResponse;

  const rows = [...data.data].sort(
    (a, b) => (a.index ?? 0) - (b.index ?? 0)
  );
  return rows.map((d) => d.embedding);
}
