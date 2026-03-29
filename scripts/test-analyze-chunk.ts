import { analyzeChunk } from "../lib/ai-analyze-chunk";

async function main() {
  if (!process.env.LAVA_SECRET_KEY?.trim()) {
    console.error(
      "Missing LAVA_SECRET_KEY (run: npm run test:analyze-chunk — uses .env via node --env-file)",
    );
    process.exit(1);
  }

  const contractContext = `SaaS agreement: Acme Corp (customer) and Vendor LLC, 12-month term, $120,000/year, auto-renews unless notice given.`;

  const chunkText = `4.2 Renewal. This Agreement shall automatically renew for successive one-year terms unless either party provides written notice of non-renewal at least sixty (60) days prior to the end of the then-current term. Upon renewal, the annual fee shall increase by eight percent (8%) over the prior year's fees.`;

  console.log("Calling analyzeChunk (OpenAI via Lava)…\n");
  const result = await analyzeChunk(chunkText, contractContext);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error("FAILED:", err instanceof Error ? err.message : err);
  if (err instanceof Error && err.stack) console.error(err.stack);
  process.exit(1);
});
