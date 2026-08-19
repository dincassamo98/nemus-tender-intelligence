import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { runSourceIngestion } from "@/lib/pipeline/run";
import { BROWSER_AUTOMATION_ADAPTER_KEYS } from "@/lib/adapters/registry";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Vercel Cron entrypoint (see vercel.json) for sources that don't need
 * browser automation (currently: UFSA). Jornal Notícias is intentionally
 * excluded — it runs only via .github/workflows/ingest.yml. Vercel signs
 * cron requests with a bearer token equal to CRON_SECRET; reject anything
 * else so this endpoint can't be used to trigger ingestion runs by a
 * random caller.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sources = await prisma.source.findMany({ where: { enabled: true, isDemo: false } });
  const results = [];
  for (const source of sources) {
    if (BROWSER_AUTOMATION_ADAPTER_KEYS.has(source.adapterKey)) continue;
    results.push({ sourceKey: source.key, ...(await runSourceIngestion(source.key, "SCHEDULED")) });
  }

  return NextResponse.json({ results });
}
