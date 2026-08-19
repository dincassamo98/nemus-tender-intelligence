import { describe, it, expect } from "vitest";
import { ruleBasedClassifier } from "@/lib/intelligence/classifier";

describe("ruleBasedClassifier", () => {
  it("scores a clear environmental/EIA consulting tender as CRITICAL or HIGH", () => {
    const result = ruleBasedClassifier.classify({
      title: "Concurso para Consultoria em Avaliação de Impacto Ambiental e Social",
      description:
        "O Ministério da Terra e Ambiente pretende contratar consultoria para a realização do Estudo de Impacto Ambiental e Social, incluindo plano de gestão ambiental e avaliação de impacto cumulativo.",
      organizationRaw: "Ministério da Terra e Ambiente",
      geography: "Maputo, Moçambique",
    });

    expect(["CRITICAL", "HIGH"]).toContain(result.classification);
    expect(result.relevanceScore).toBeGreaterThan(60);
    expect(result.matchingCapabilities).toContain("Environmental & Social Impact Assessment");
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it("caps score low when only generic procurement language matches (no real domain signal)", () => {
    const result = ruleBasedClassifier.classify({
      title: "Concurso Público para Fornecimento de Material de Escritório",
      description: "Concurso para prestação de serviços de fornecimento de material de escritório diverso.",
      organizationRaw: "Direcção Nacional de Águas",
    });

    expect(result.relevanceScore).toBeLessThanOrEqual(25);
    expect(["LOW", "NOT_RELEVANT"]).toContain(result.classification);
  });

  it("scores an unrelated auction notice as NOT_RELEVANT", () => {
    const result = ruleBasedClassifier.classify({
      title: "Aviso de Leilão de Equipamento Informático Obsoleto",
      description: "Leilão público de equipamento informático obsoleto fora de uso.",
      organizationRaw: "Empresa Privada de Telecomunicações",
    });

    expect(result.classification).toBe("NOT_RELEVANT");
  });

  it("never returns a negative or >100 score", () => {
    const result = ruleBasedClassifier.classify({
      title: "Concurso Concurso Concurso Ambiental Ambiental Ambiental Ambiental Sustentabilidade Biodiversidade Clima",
      description: "avaliação de impacto ambiental ".repeat(20),
      organizationRaw: "Ministério da Terra e Ambiente, Banco Mundial",
      geography: "Maputo",
    });
    expect(result.relevanceScore).toBeLessThanOrEqual(100);
    expect(result.relevanceScore).toBeGreaterThanOrEqual(0);
  });

  it("flags missing information when description is too short", () => {
    const result = ruleBasedClassifier.classify({
      title: "Concurso",
      description: "",
      organizationRaw: "",
    });
    expect(result.missingInformation.length).toBeGreaterThan(0);
    expect(result.confidenceScore).toBeLessThan(70);
  });
});
