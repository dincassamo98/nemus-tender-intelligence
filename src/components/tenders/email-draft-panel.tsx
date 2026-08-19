"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

const PURPOSES = [
  { value: "CLARIFICATION", label: "Pedir esclarecimento" },
  { value: "REQUEST_DOCUMENTS", label: "Solicitar documentos" },
  { value: "EXPRESS_INTEREST", label: "Manifestar interesse" },
  { value: "ELIGIBILITY", label: "Questão de elegibilidade" },
  { value: "OTHER", label: "Outro" },
];

export function EmailDraftPanel({ tenderId, organizationEmailHint }: { tenderId: string; organizationEmailHint?: string | null }) {
  const [open, setOpen] = useState(false);
  const [purpose, setPurpose] = useState("CLARIFICATION");
  const [draft, setDraft] = useState<{ subject: string; body: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function generate() {
    setLoading(true);
    setDraft(null);
    const res = await fetch(`/api/tenders/${tenderId}/email-draft`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ purpose }),
    });
    const data = await res.json();
    setDraft({ subject: data.draft.subject, body: data.draft.body });
    setLoading(false);
  }

  if (!open) {
    return (
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        ✉️ Enviar e-mail
      </Button>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">Gerar rascunho de e-mail</p>
        <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground" aria-label="Fechar">
          ✕
        </button>
      </div>

      <Alert tone="info" className="mb-3">
        O rascunho é gerado a partir dos dados guardados deste concurso — nada é inventado. Reveja e edite antes de enviar.
      </Alert>

      <div className="mb-3 flex flex-wrap gap-2">
        <select value={purpose} onChange={(e) => setPurpose(e.target.value)} className="h-9 rounded-md border border-border bg-background px-2 text-sm">
          {PURPOSES.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
        <Button size="sm" onClick={generate} disabled={loading}>
          {loading ? "A gerar…" : draft ? "Gerar novamente" : "Gerar rascunho"}
        </Button>
      </div>

      {draft ? (
        <div className="space-y-2">
          <input
            value={draft.subject}
            onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-medium"
          />
          <textarea
            value={draft.body}
            onChange={(e) => setDraft({ ...draft, body: e.target.value })}
            rows={12}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                navigator.clipboard.writeText(`Assunto: ${draft.subject}\n\n${draft.body}`);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
            >
              {copied ? "Copiado ✓" : "Copiar"}
            </Button>
            <a
              href={`mailto:${organizationEmailHint ?? ""}?subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(draft.body)}`}
              className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
            >
              Abrir no cliente de email
            </a>
          </div>
        </div>
      ) : null}
    </div>
  );
}
