/**
 * CLI ingestion entrypoint. Used both for local development
 * (`pnpm ingest` / `pnpm ingest --source ufsa`) and by the scheduled
 * GitHub Actions worker (.github/workflows/ingest.yml) for the
 * Playwright-heavy Jornal Notícias adapter that can't run inside a Vercel
 * serverless function. Talks directly to the database via Prisma — it does
 * not go through the Next.js app at all.
 */
import { prisma } from "../src/lib/db";
import { runSourceIngestion } from "../src/lib/pipeline/run";

async function main() {
  const args = process.argv.slice(2);
  const sourceArgIdx = args.indexOf("--source");
  const requestedSourceKey = sourceArgIdx >= 0 ? args[sourceArgIdx + 1] : null;

  const sources = requestedSourceKey
    ? await prisma.source.findMany({ where: { key: requestedSourceKey, enabled: true } })
    : await prisma.source.findMany({ where: { enabled: true, isDemo: false } });

  if (sources.length === 0) {
    console.log(requestedSourceKey ? `No enabled source found with key "${requestedSourceKey}".` : "No enabled non-demo sources configured.");
    return;
  }

  for (const source of sources) {
    console.log(`\n=== Running ingestion for "${source.name}" (${source.key}) ===`);
    const result = await runSourceIngestion(source.key, "SCHEDULED");
    console.log(
      `Status: ${result.status} | discovered=${result.itemsDiscovered} new=${result.itemsNew} updated=${result.itemsUpdated} duplicate=${result.itemsDuplicate} errors=${result.errorsCount}`
    );
  }
}

main()
  .catch((err) => {
    console.error("Ingestion run failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
