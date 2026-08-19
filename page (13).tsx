import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CLASSIFICATION_THRESHOLDS } from "@/lib/intelligence/classifier";

export const dynamic = "force-dynamic";
import { DEFAULT_URGENCY_THRESHOLDS } from "@/lib/deadline";

export default async function SettingsPage() {
  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" }, select: { id: true, name: true, email: true, role: true } });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Definições</h1>
        <p className="text-sm text-muted-foreground">Configuração do classificador, prazos, utilizadores e ligações externas.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Limiares do classificador de relevância</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-muted-foreground">
            Definidos em <code className="rounded bg-muted px-1">src/lib/intelligence/classifier.ts</code>. Ajustar aqui requer alterar o
            código e fazer novo deploy — mantidos como constante única e não espalhados pelo código.
          </p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(CLASSIFICATION_THRESHOLDS).map(([k, v]) => (
              <Badge key={k} tone="neutral">
                {k} ≥ {v}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Limiares de urgência de prazo</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Badge tone="neutral">Confortável ≥ {DEFAULT_URGENCY_THRESHOLDS.comfortableDays}d</Badge>
          <Badge tone="neutral">A aproximar-se ≥ {DEFAULT_URGENCY_THRESHOLDS.approachingDays}d</Badge>
          <Badge tone="neutral">Em breve ≥ {DEFAULT_URGENCY_THRESHOLDS.soonDays}d</Badge>
          <Badge tone="neutral">Urgente &lt; {DEFAULT_URGENCY_THRESHOLDS.urgentHours}h</Badge>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Utilizadores</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {users.map((u) => (
            <div key={u.id} className="flex items-center justify-between text-sm">
              <span className="text-foreground">
                {u.name} <span className="text-muted-foreground">({u.email})</span>
              </span>
              <Badge tone={u.role === "ADMIN" ? "primary" : "neutral"}>{u.role}</Badge>
            </div>
          ))}
          <p className="pt-2 text-xs text-muted-foreground">
            Gestão de utilizadores via linha de comando por agora (<code className="rounded bg-muted px-1">prisma/seed.ts</code>) — um
            ecrã de convite fica para uma fase posterior.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ligações externas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-foreground">Credenciais Jornal Notícias</span>
            <Badge tone={process.env.NOTICIAS_EMAIL && process.env.NOTICIAS_PASSWORD ? "success" : "warning"}>
              {process.env.NOTICIAS_EMAIL && process.env.NOTICIAS_PASSWORD ? "Configuradas" : "Não configuradas"}
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-foreground">Disparo do GitHub Actions (fontes com automação de navegador)</span>
            <Badge tone={process.env.GITHUB_DISPATCH_TOKEN ? "success" : "warning"}>
              {process.env.GITHUB_DISPATCH_TOKEN ? "Configurado" : "Não configurado"}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
