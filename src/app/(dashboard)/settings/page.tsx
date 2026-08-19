import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" }, select: { id: true, name: true, email: true, role: true } });

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Definições</h1>
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <p className="mb-2 text-sm font-medium text-foreground">Utilizadores</p>
        <div className="space-y-2">
          {users.map((u) => (
            <div key={u.id} className="flex items-center justify-between text-sm">
              <span className="text-foreground">
                {u.name} <span className="text-muted-foreground">({u.email})</span>
              </span>
              <Badge tone={u.role === "ADMIN" ? "primary" : "neutral"}>{u.role}</Badge>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
