import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/db";
import { runSourceIngestion } from "../src/lib/pipeline/run";

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
    update: {},
    create: { email: adminEmail, name: adminName, passwordHash, role: "ADMIN" },
  });
  console.log(`Seeded admin user: ${adminEmail}`);

  const sources: Parameters<typeof prisma.source.upsert>[0][] = [
    {
      where: { key: "demo" },
      update: {},
      create: {
        key: "demo",
        name: "Demo Data (synthetic)",
        type: "DEMO",
        baseUrl: "internal://demo",
        authRequired: false,
        adapterKey: "demo",
        enabled: true,
        isDemo: true,
        schedule: null,
        config: {},
        notes: "Synthetic sample data so the platform is demonstrable before live credentials are configured. Never mixed with real discoveries — see Source.isDemo.",
      },
    },
    {
      where: { key: "ufsa" },
      update: {},
      create: {
        key: "ufsa",
        name: "UFSA — Portal de Concursos Públicos",
        type: "GOVERNMENT_PORTAL",
        baseUrl: "https://www.ufsa.gov.mz/concursos.php",
        authRequired: false,
        adapterKey: "ufsa",
        enabled: false, // enable once validated against the live site (see adapter validationStatus)
        schedule: "0 6,14 * * *",
        config: { lookbackDays: 3 },
        notes:
          "Official Mozambican public procurement portal. Plain government pages, no auth. Adapter built generically since this sandbox could not reach the live site to inspect markup — validate before enabling in production.",
      },
    },
    {
      where: { key: "jornal-noticias" },
      update: {},
      create: {
        key: "jornal-noticias",
        name: "Jornal Notícias (Sociedade do Notícias)",
        type: "NEWSPAPER_FLIPBOOK",
        baseUrl: "https://flipbook-snoticias.app.co.mz/login.php",
        authRequired: true,
        adapterKey: "jornal-noticias",
        enabled: false, // enable once validated against the live site with real credentials
        schedule: "0 7,15 * * *",
        config: { lookbackDays: 3 },
        notes:
          "Paid subscription, authenticated flipbook reader. The source itself keeps no back-catalogue, so daily capture is required. Run only via the GitHub Actions worker or local CLI — needs a real browser (Playwright), not a Vercel function. Validate against the live site before enabling.",
      },
    },
  ];

  for (const s of sources) {
    await prisma.source.upsert(s);
  }
  console.log("Seeded sources: demo, ufsa (disabled), jornal-noticias (disabled).");

  const existingDemoTenders = await prisma.tender.count({ where: { source: { key: "demo" } } });
  if (existingDemoTenders === 0) {
    console.log("Running demo ingestion to populate sample tenders…");
    const result = await runSourceIngestion("demo", "MANUAL");
    console.log(`Demo ingestion: ${result.status}, ${result.itemsNew} tenders created.`);
  } else {
    console.log(`Demo tenders already present (${existingDemoTenders}) — skipping demo ingestion.`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
