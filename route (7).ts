import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/require-user";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sources = await prisma.source.findMany({
    orderBy: { name: "asc" },
    include: {
      runs: { orderBy: { startedAt: "desc" }, take: 5 },
      _count: { select: { tenders: true } },
    },
  });

  return NextResponse.json({ sources });
}
