import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/require-user";
import { generateEmailDraft } from "@/lib/intelligence/email";

export const runtime = "nodejs";

const schema = z.object({
  purpose: z.enum(["CLARIFICATION", "REQUEST_DOCUMENTS", "EXPRESS_INTEREST", "ELIGIBILITY", "OTHER"]),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { purpose } = schema.parse(await req.json());

  const tender = await prisma.tender.findUniqueOrThrow({ where: { id } });

  const draft = generateEmailDraft(purpose, {
    tenderTitle: tender.title,
    organizationRaw: tender.organizationRaw,
    externalRef: tender.externalRef,
    deadline: tender.deadline,
    sourceUrl: tender.sourceUrl,
    senderName: user.name ?? "Nemus África",
  });

  const saved = await prisma.emailDraft.create({
    data: {
      tenderId: id,
      purpose,
      subject: draft.subject,
      body: draft.body,
      groundedFields: draft.groundedFields,
      createdById: user.id,
    },
  });

  await prisma.activity.create({
    data: { tenderId: id, userId: user.id, type: "EMAIL_DRAFTED", description: `Drafted a ${purpose.toLowerCase().replace("_", " ")} email` },
  });

  return NextResponse.json({ draft: saved });
}
