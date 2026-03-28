import { embedBatch, embedText } from "../lib/embeddings";

async function main() {
  if (!process.env.LAVA_SECRET_KEY?.trim()) {
    console.error("Missing LAVA_SECRET_KEY (use .env with node --env-file=.env)");
    process.exit(1);
  }

  console.log("embedText…");
  const one = await embedText("hello from embedding test");
  console.log("  OK — dims:", one.length, "first values:", one.slice(0, 3).join(", "));

  console.log("embedBatch…");
  const many = await embedBatch(["alpha", "beta"]);
  console.log(
    "  OK — vectors:",
    many.length,
    "dims each:",
    many.map((v) => v.length).join(", "),
  );
}

main().catch((err) => {
  console.error("FAILED:", err instanceof Error ? err.message : err);
  if (err instanceof Error && err.stack) console.error(err.stack);
  process.exit(1);
});
