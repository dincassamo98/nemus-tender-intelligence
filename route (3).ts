import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/require-user";

export const runtime = "nodejs";

const schema = z.object({ body: z.string().min(1).max(5000) });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { body } = schema.parse(await req.json());

  const note = await prisma.note.create({
    data: { tenderId: id, userId: user.id, body },
    include: { user: { select: { name: true } } },
  });

  await prisma.activity.create({
    data: { tenderId: id, userId: user.id, type: "NOTE_ADDED", description: `Note added: "${body.slice(0, 80)}${body.length > 80 ? "…" : ""}"` },
  });

  return NextResponse.json({ note });
}
