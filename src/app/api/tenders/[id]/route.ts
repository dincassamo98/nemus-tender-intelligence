import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/require-user";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const tender = await prisma.tender.findUnique({
    where: { id },
    include: {
      source: true,
      edition: true,
      organization: true,
      assignedTo: { select: { id: true, name: true, email: true } },
      documents: true,
      versions: { orderBy: { versionNumber: "desc" } },
      changes: { orderBy: { detectedAt: "desc" } },
      notes: { include: { user: { select: { name: true } } }, orderBy: { createdAt: "desc" } },
      activities: { include: { user: { select: { name: true } } }, orderBy: { createdAt: "desc" } },
      emailDrafts: { orderBy: { createdAt: "desc" } },
      provenance: true,
      feedback: true,
      duplicates: { select: { id: true, title: true, sourceUrl: true } },
    },
  });

  if (!tender) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Similar opportunities: same category tags or same organization, excluding self.
  const related = await prisma.tender.findMany({
    where: {
      id: { not: id },
      OR: [
        { organizationId: tender.organizationId ?? undefined },
        { categoryTags: { hasSome: tender.categoryTags } },
      ],
    },
    take: 5,
    orderBy: { relevanceScore: "desc" },
    select: { id: true, title: true, relevanceScore: true, classification: true, deadline: true, organizationRaw: true },
  });

  return NextResponse.json({ tender, related });
}

const patchSchema = z.object({
  status: z.enum(["NEW", "REVIEWING", "PURSUING", "SUBMITTED", "WON", "LOST", "REJECTED", "EXPIRED"]).optional(),
  watchlisted: z.boolean().optional(),
  reviewed: z.boolean().optional(),
  assignedToId: z.string().nullable().optional(),
  relevanceScoreOverride: z.number().min(0).max(100).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = patchSchema.parse(await req.json());

  const existing = await prisma.tender.findUniqueOrThrow({ where: { id } });
  const activityDescriptions: string[] = [];
  const data: Record<string, unknown> = {};

  if (body.status && body.status !== existing.status) {
    data.status = body.status;
    activityDescriptions.push(`Status changed from ${existing.status} to ${body.status}`);
  }
  if (body.watchlisted !== undefined && body.watchlisted !== existing.watchlisted) {
    data.watchlisted = body.watchlisted;
    activityDescriptions.push(body.watchlisted ? "Added to watchlist" : "Removed from watchlist");
  }
  if (body.reviewed !== undefined && body.reviewed !== existing.reviewed) {
    data.reviewed = body.reviewed;
    data.reviewedAt = body.reviewed ? new Date() : null;
    activityDescriptions.push(body.reviewed ? "Marked as reviewed" : "Marked as not reviewed");
  }
  if (body.assignedToId !== undefined && body.assignedToId !== existing.assignedToId) {
    data.assignedToId = body.assignedToId;
    activityDescriptions.push(body.assignedToId ? `Assigned to user ${body.assignedToId}` : "Unassigned");
  }
  if (body.relevanceScoreOverride !== undefined) {
    data.relevanceScore = body.relevanceScoreOverride;
    activityDescriptions.push(`Relevance score manually corrected from ${existing.relevanceScore} to ${body.relevanceScoreOverride}`);
    await prisma.humanFeedback.create({
      data: {
        tenderId: id,
        userId: user.id,
        feedbackType: "SCORE_CORRECTION",
        previousScore: existing.relevanceScore,
        correctedScore: body.relevanceScoreOverride,
      },
    });
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ tender: existing });
  }

  const updated = await prisma.tender.update({ where: { id }, data });

  await prisma.activity.createMany({
    data: activityDescriptions.map((description) => ({
      tenderId: id,
      userId: user.id,
      type: body.status ? "STATUS_CHANGE" : body.watchlisted !== undefined ? "WATCHLISTED" : body.assignedToId !== undefined ? "ASSIGNED" : "SCORE_OVERRIDE",
      description,
    })),
  });

  return NextResponse.json({ tender: updated });
}
