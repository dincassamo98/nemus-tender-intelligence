import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/require-user";

export const runtime = "nodejs";

const schema = z.object({
  feedbackType: z.enum(["RELEVANT", "NOT_RELEVANT", "MAYBE", "PURSUE", "IGNORE"]),
  comment: z.string().max(2000).optional(),
});

/**
 * Human-in-the-loop feedback (spec sections 8C, 39). Doesn't change the
 * classifier score automatically yet — it's recorded so future classifier
 * tuning (or a future ML/embeddings model) has real labeled data to learn
 * from, per docs/ARCHITECTURE.md "Classifier evolution path".
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { feedbackType, comment } = schema.parse(await req.json());

  const tender = await prisma.tender.findUniqueOrThrow({ where: { id } });

  const feedback = await prisma.humanFeedback.create({
    data: { tenderId: id, userId: user.id, feedbackType, comment, previousScore: tender.relevanceScore },
  });

  await prisma.activity.create({
    data: { tenderId: id, userId: user.id, type: "SYSTEM", description: `Feedback recorded: ${feedbackType}${comment ? ` — "${comment}"` : ""}` },
  });

  return NextResponse.json({ feedback });
}
