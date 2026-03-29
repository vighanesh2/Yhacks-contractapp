import { Lava } from "@lavapayments/nodejs";

/** One Lava client for all OpenAI routes (embeddings, chat, etc.) via the gateway. */
export const lavaOpenAI = new Lava();

export const OPENAI_V1_BASE = "https://api.openai.com/v1";
