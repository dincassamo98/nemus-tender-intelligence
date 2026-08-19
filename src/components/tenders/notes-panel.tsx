"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface NoteItem {
  id: string;
  body: string;
  createdAt: string | Date;
  user: { name: string };
}

export function NotesPanel({ tenderId, notes }: { tenderId: string; notes: NoteItem[] }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!value.trim()) return;
    setSubmitting(true);
    await fetch(`/api/tenders/${tenderId}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: value }),
    });
    setValue("");
    setSubmitting(false);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Adicionar uma nota…"
          className="h-9 flex-1 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <Button size="sm" onClick={submit} disabled={submitting}>
          Adicionar
        </Button>
      </div>
      <div className="space-y-2">
        {notes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem notas ainda.</p>
        ) : (
          notes.map((n) => (
            <div key={n.id} className="rounded-md bg-muted p-2 text-sm">
              <p className="text-foreground">{n.body}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {n.user.name} · {new Date(n.createdAt).toLocaleString("pt-PT")}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
