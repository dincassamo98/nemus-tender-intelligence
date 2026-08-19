import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/require-user";

export const runtime = "nodejs";

const PAGE_SIZE = 25;

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const where: Prisma.TenderWhereInput = {};

  const status = sp.get("status");
  if (status) where.status = status as never;

  const classification = sp.get("classification");
  if (classification) where.classification = classification as never;

  if (sp.get("watchlisted") === "true") where.watchlisted = true;

  const sourceKey = sp.get("source");
  if (sourceKey) where.source = { key: sourceKey };

  const assignedToId = sp.get("assignedTo");
  if (assignedToId) where.assignedToId = assignedToId;

  const minScore = sp.get("minScore");
  if (minScore) where.relevanceScore = { gte: Number(minScore) };

  const deadlineWithinDays = sp.get("deadlineWithinDays");
  if (deadlineWithinDays) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + Number(deadlineWithinDays));
    where.deadline = { lte: cutoff, gte: new Date() };
  }

  const search = sp.get("q");
  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
      { organizationRaw: { contains: search, mode: "insensitive" } },
    ];
  }

  const includeDemo = sp.get("includeDemo") === "true";
  if (!includeDemo) where.source = { ...(where.source as object), isDemo: false };
  else if (sp.get("demoOnly") === "true") where.source = { isDemo: true };

  const page = Math.max(1, Number(sp.get("page") ?? "1"));
  const sortParam = sp.get("sort") ?? "relevance";
  const orderBy: Prisma.TenderOrderByWithRelationInput =
    sortParam === "deadline"
      ? { deadline: "asc" }
      : sortParam === "recent"
        ? { discoveredAt: "desc" }
        : { relevanceScore: "desc" };

  const [tenders, total] = await Promise.all([
    prisma.tender.findMany({
      where,
      orderBy,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        source: { select: { key: true, name: true, isDemo: true } },
        assignedTo: { select: { id: true, name: true } },
      },
    }),
    prisma.tender.count({ where }),
  ]);

  return NextResponse.json({ tenders, total, page, pageSize: PAGE_SIZE });
}
