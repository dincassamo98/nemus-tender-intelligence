import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/db";

/**
 * Seeds exactly two things: the admin user and the real source registry.
 * No demo/mock tender data — an empty database is a valid, honest state.
 * Real tenders only ever come from the ingestion pipeline actually
 * contacting a real source (scripts/ingest.ts or the Refresh button).
 */
async function main() {
  const adminEmail = process.env.ADMIN_EMAIL ?? "iris@nemus.africa";
  const adminName = process.env.ADMIN_NAME ?? "Iris";
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    throw new Error("ADMIN_PASSWORD must be set (see .env.example) before seeding — refusing to create a user with no password.");
  }

  const passwordHash = await bcrypt.hash(adminPassword, 12);
  await prisma.user.upsert({
    where: { email: adminEmail },
    // Update on every run (not a no-op) so redeploying after changing
    // ADMIN_PASSWORD in the hosting platform's env vars actually takes
    // effect, instead of silently keeping whatever password was set on
    // the very first successful seed.
    update: { name: adminName, passwordHash },
    create: { email: adminEmail, name: adminName, passwordHash, role: "ADMIN" },
  });
  console.log(`Seeded admin user: ${adminEmail}`);

  // This list is the source of truth for source config, including `enabled`
  // — every field syncs on every deploy (not just on first create), so
  // this file is what determines whether a source is active, not a
  // one-off manual DB edit. There's no admin UI for this yet; until there
  // is, "should this source be on" is a code change here, deliberately,
  // so it's visible in git history rather than a silent DB toggle nobody
  // remembers making.
  const sources: { key: string; data: Omit<Parameters<typeof prisma.source.create>[0]["data"], "key"> }[] = [
    {
      key: "ufsa",
      data: {
        name: "UFSA — Portal de Concursos Públicos (abertos)",
        type: "GOVERNMENT_PORTAL",
        baseUrl: "https://ufsa.dotcom.co.mz/concursos?status=OPEN",
        authRequired: false,
        adapterKey: "ufsa",
        enabled: true,
        schedule: "0 6 * * *",
        config: { lookbackDays: 3 },
        notes: "Official Mozambican public procurement portal, filtered to open tenders.",
      },
    },
    {
      key: "jornal-noticias",
      data: {
        name: "Jornal Notícias (Sociedade do Notícias)",
        type: "NEWSPAPER_FLIPBOOK",
        baseUrl: "https://flipbook-snoticias.app.co.mz/login.php",
        authRequired: true,
        adapterKey: "jornal-noticias",
        enabled: true,
        schedule: "0 7 * * *",
        config: { lookbackDays: 3 },
        notes:
          "Paid subscription, authenticated flipbook reader — Iris's primary source today. Prioritizes the 'Pedido de Manifestação de Interesse' and 'Anúncio de Concurso' sections. Requires NOTICIAS_EMAIL/NOTICIAS_PASSWORD to be set; without them this source reports a clear configuration error rather than running. Runs only via the GitHub Actions worker or local CLI — needs a real browser (Playwright), not a Vercel function.",
      },
    },
    {
      key: "diario-economico",
      data: {
        name: "Diário Económico — Concursos Públicos",
        type: "AGGREGATOR",
        baseUrl: "https://www.diarioeconomico.co.mz/category/concursos-publicos/",
        authRequired: false,
        adapterKey: "diario-economico",
        enabled: true,
        schedule: "0 8 * * *",
        config: { lookbackDays: 5 },
        notes: "Mozambican business publication with a dedicated public-tenders category.",
      },
    },
    {
      key: "mozconnections",
      data: {
        name: "MozConnections — Concursos",
        type: "AGGREGATOR",
        baseUrl: "https://concursos.mozconnections.co.mz/",
        authRequired: false,
        adapterKey: "mozconnections",
        enabled: true,
        schedule: "0 8 * * *",
        config: { lookbackDays: 5 },
        notes: "Mozambican opportunities platform (tenders + jobs), tenders-only subdomain.",
      },
    },
    {
      key: "undp",
      data: {
        name: "UNDP Procurement Notices — Mozambique",
        type: "UN_AGENCY",
        baseUrl: "https://procurement-notices.undp.org/search.cfm",
        authRequired: false,
        adapterKey: "undp",
        enabled: true,
        schedule: "0 9 * * *",
        config: { lookbackDays: 7 },
        notes: "First of the UN-family adapters. Public, unauthenticated, filters to Mozambique-tagged notices.",
      },
    },
  ];

  for (const s of sources) {
    await prisma.source.upsert({ where: { key: s.key }, update: s.data, create: { key: s.key, ...s.data } });
  }
  console.log("Seeded 5 real sources (all enabled, synced on every run). No demo data seeded.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
