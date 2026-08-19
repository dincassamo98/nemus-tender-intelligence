import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/require-user";
import { runSourceIngestion } from "@/lib/pipeline/run";
import { BROWSER_AUTOMATION_ADAPTER_KEYS } from "@/lib/adapters/registry";

export const runtime = "nodejs";
export const maxDuration = 60;

const schema = z.object({ sourceKey: z.string().optional() });

async function dispatchGithubWorkflow(sourceKey: string): Promise<{ dispatched: boolean; message: string }> {
  const token = process.env.GITHUB_DISPATCH_TOKEN;
  const repo = process.env.GITHUB_DISPATCH_REPO;
  if (!token || !repo) {
    return {
      dispatched: false,
      message:
        "This source requires browser automation and can't run from the web app. Configure GITHUB_DISPATCH_TOKEN/GITHUB_DISPATCH_REPO to let Refresh trigger the GitHub Actions worker, or run `pnpm ingest --source " +
        sourceKey +
        "` from a machine with network access to the source.",
    };
  }

  const res = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/ingest.yml/dispatches`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ref: "main", inputs: { source: sourceKey } }),
  });

  if (!res.ok) {
    return { dispatched: false, message: `GitHub Actions dispatch failed: HTTP ${res.status}` };
  }
  return { dispatched: true, message: "Dispatched to the scheduled GitHub Actions worker — this can take a few minutes." };
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { sourceKey } = schema.parse(await req.json().catch(() => ({})));

  const sources = sourceKey
    ? await prisma.source.findMany({ where: { key: sourceKey, enabled: true } })
    : await prisma.source.findMany({ where: { enabled: true, isDemo: false } });

  if (sources.length === 0) {
    return NextResponse.json({ error: "No enabled source(s) to run." }, { status: 400 });
  }

  const results = [];
  for (const source of sources) {
    if (BROWSER_AUTOMATION_ADAPTER_KEYS.has(source.adapterKey)) {
      const dispatch = await dispatchGithubWorkflow(source.key);
      results.push({ sourceKey: source.key, mode: "dispatched", ...dispatch });
    } else {
      const summary = await runSourceIngestion(source.key, "MANUAL", user.id);
      results.push({ sourceKey: source.key, mode: "inline", ...summary });
    }
  }

  return NextResponse.json({ results });
}
