import { describe, it, expect } from "vitest";
import { findDuplicateCandidate, computeDedupeKey, type ExistingTenderLite } from "@/lib/pipeline/dedupe";

const baseExisting: ExistingTenderLite = {
  id: "existing-1",
  externalRef: "MICOA/DNAAS/012/2026",
  organizationRaw: "Ministério da Terra e Ambiente",
  title: "Concurso para Consultoria em Avaliação de Impacto Ambiental — Corredor de Nacala",
  sourceUrl: "https://flipbook-snoticias.app.co.mz/edicao/2026-08-18",
  announcementUrl: "https://flipbook-snoticias.app.co.mz/edicao/2026-08-18#pagina-14",
  deadline: new Date("2026-09-14"),
  documentHashes: ["abc123"],
};

describe("findDuplicateCandidate", () => {
  it("matches on exact reference number + organization", () => {
    const result = findDuplicateCandidate(
      {
        externalRef: "MICOA/DNAAS/012/2026",
        organizationRaw: "Ministério da Terra e Ambiente",
        title: "Different title text entirely",
        sourceUrl: "https://other-source.example.com",
        announcementUrl: null,
        deadline: new Date("2026-09-14"),
        documentHashes: [],
      },
      [baseExisting]
    );
    expect(result.matchType).toBe("EXACT_REFERENCE");
    expect(result.match?.id).toBe("existing-1");
  });

  it("matches on shared document hash across different sources", () => {
    const result = findDuplicateCandidate(
      {
        externalRef: null,
        organizationRaw: "Some Other Org Name",
        title: "Completely different title",
        sourceUrl: "https://another-source.example.com",
        announcementUrl: null,
        deadline: null,
        documentHashes: ["abc123", "def456"],
      },
      [baseExisting]
    );
    expect(result.matchType).toBe("DOCUMENT_HASH");
  });

  it("fuzzy-matches similar org + title without exact reference", () => {
    const result = findDuplicateCandidate(
      {
        externalRef: null,
        organizationRaw: "Ministerio da Terra e Ambiente", // no accent, still similar
        title: "Concurso para Consultoria em Avaliacao de Impacto Ambiental Corredor Nacala",
        sourceUrl: "https://different-url.example.com",
        announcementUrl: null,
        deadline: new Date("2026-09-14"),
        documentHashes: [],
      },
      [baseExisting]
    );
    expect(result.matchType).toBe("FUZZY_MATCH");
    expect(result.similarity).toBeGreaterThan(0.6);
  });

  it("does NOT match unrelated tenders (no false positive)", () => {
    const result = findDuplicateCandidate(
      {
        externalRef: null,
        organizationRaw: "Conselho Municipal de Maputo",
        title: "Fornecimento de material de escritório",
        sourceUrl: "https://x.example.com",
        announcementUrl: null,
        deadline: null,
        documentHashes: [],
      },
      [baseExisting]
    );
    expect(result.match).toBeNull();
  });

  it("flags hasDifferences when the deadline changed on an otherwise-matching tender", () => {
    const result = findDuplicateCandidate(
      {
        externalRef: "MICOA/DNAAS/012/2026",
        organizationRaw: "Ministério da Terra e Ambiente",
        title: "Concurso para Consultoria em Avaliação de Impacto Ambiental — Corredor de Nacala",
        sourceUrl: "https://flipbook-snoticias.app.co.mz/edicao/2026-08-25",
        announcementUrl: null,
        deadline: new Date("2026-09-21"), // changed
        documentHashes: [],
      },
      [baseExisting]
    );
    expect(result.match).not.toBeNull();
    expect(result.hasDifferences).toBe(true);
  });

  it("computeDedupeKey is stable for the same org+title regardless of accents/case", () => {
    const a = computeDedupeKey("Ministério da Terra e Ambiente", "Concurso ABC");
    const b = computeDedupeKey("ministerio da terra e ambiente", "concurso abc");
    expect(a).toBe(b);
  });
});
