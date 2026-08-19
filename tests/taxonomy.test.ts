import { describe, it, expect } from "vitest";
import { classifyOpportunityTypes, detectPrioritySectionHeader } from "@/lib/intelligence/taxonomy";

describe("classifyOpportunityTypes", () => {
  it("maps Portuguese terminology to canonical types", () => {
    expect(classifyOpportunityTypes("Pedido de Manifestação de Interesse para consultoria")).toContain(
      "PEDIDO_MANIFESTACAO_INTERESSE"
    );
    expect(classifyOpportunityTypes("Anúncio de Concurso Público")).toContain("ANUNCIO_CONCURSO");
  });

  it("maps English/international terminology to canonical types", () => {
    expect(classifyOpportunityTypes("Request for Proposals for environmental consulting")).toContain("REQUEST_FOR_PROPOSAL");
    expect(classifyOpportunityTypes("Call for Expressions of Interest")).toContain("EXPRESSION_OF_INTEREST");
  });

  it("returns OTHER when nothing matches", () => {
    expect(classifyOpportunityTypes("Texto completamente genérico sem qualquer termo de aquisição")).toEqual(["OTHER"]);
  });

  it("can match multiple types at once", () => {
    const types = classifyOpportunityTypes("Pedido de Manifestação de Interesse — Serviços de Consultoria Ambiental");
    expect(types).toContain("PEDIDO_MANIFESTACAO_INTERESSE");
    expect(types).toContain("CONSULTANCY");
  });
});

describe("detectPrioritySectionHeader", () => {
  it("matches an exact section header", () => {
    const result = detectPrioritySectionHeader("Anúncio de Concurso");
    expect(result?.header).toBe("Anúncio de Concurso");
  });

  it("tolerates missing accents (common OCR failure)", () => {
    const result = detectPrioritySectionHeader("Anuncio de Concurso");
    expect(result).not.toBeNull();
  });

  it("tolerates minor OCR noise", () => {
    const result = detectPrioritySectionHeader("Pedido de Manifestacao de lnteresse"); // OCR "I" -> "l"
    expect(result).not.toBeNull();
  });

  it("does not match unrelated short lines", () => {
    expect(detectPrioritySectionHeader("Desporto")).toBeNull();
  });

  it("does not match body paragraphs (too long)", () => {
    const longLine =
      "Este é um parágrafo longo de texto que não deve ser confundido com um cabeçalho de secção mesmo contendo palavras semelhantes";
    expect(detectPrioritySectionHeader(longLine)).toBeNull();
  });
});
