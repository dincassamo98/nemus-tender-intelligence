import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/require-user";

export const runtime = "nodejs";

/** Polled by the Refresh UI to show live per-source progress (spec section 27). */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const since = new Date(Date.now() - 30 * 60 * 1000);
  const runs = await prisma.sourceRun.findMany({
    where: { startedAt: { gte: since } },
    orderBy: { startedAt: "desc" },
    take: 20,
    include: { source: { select: { key: true, name: true } } },
  });

  return NextResponse.json({ runs });
}
