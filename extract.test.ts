import { describe, it, expect } from "vitest";
import { extractDates, extractDeadline, extractReferenceNumber, guessOrganization } from "@/lib/pipeline/extract";

describe("extractDates", () => {
  it("parses long-form Portuguese dates", () => {
    const dates = extractDates("O prazo termina no dia 14 de Setembro de 2026 às 16h00.");
    expect(dates).toHaveLength(1);
    expect(dates[0].getUTCFullYear()).toBe(2026);
    expect(dates[0].getUTCMonth()).toBe(8); // September = 8 (0-indexed)
    expect(dates[0].getUTCDate()).toBe(14);
  });

  it("parses numeric dd/mm/yyyy dates", () => {
    const dates = extractDates("Data limite: 14/09/2026");
    expect(dates).toHaveLength(1);
    expect(dates[0].getUTCDate()).toBe(14);
    expect(dates[0].getUTCMonth()).toBe(8);
  });

  it("returns an empty array when no date is present", () => {
    expect(extractDates("Sem datas neste texto.")).toHaveLength(0);
  });
});

describe("extractDeadline", () => {
  it("prefers a date near a deadline marker over other dates in the text", () => {
    const text = "Publicado em 01 de Agosto de 2026. Prazo limite de entrega: 14 de Setembro de 2026.";
    const deadline = extractDeadline(text);
    expect(deadline?.getUTCMonth()).toBe(8);
    expect(deadline?.getUTCDate()).toBe(14);
  });

  it("returns undefined when no deadline marker is present", () => {
    expect(extractDeadline("Publicado em 01 de Agosto de 2026, sem outras datas relevantes.")).toBeUndefined();
  });
});

describe("extractReferenceNumber", () => {
  it("extracts a reference number after 'Ref.'", () => {
    expect(extractReferenceNumber("Concurso Ref. MICOA/DNAAS/012/2026 para consultoria")).toBe("MICOA/DNAAS/012/2026");
  });

  it("returns undefined when no reference pattern is present", () => {
    expect(extractReferenceNumber("Concurso público sem número de referência indicado")).toBeUndefined();
  });
});

describe("guessOrganization", () => {
  it("finds a line containing a known institutional marker", () => {
    const org = guessOrganization("Texto introdutório.\nMinistério da Terra e Ambiente convida à apresentação de propostas.\nOutro texto.");
    expect(org).toContain("Ministério da Terra e Ambiente");
  });

  it("returns undefined when no institutional marker is found", () => {
    expect(guessOrganization("Texto genérico sem qualquer marcador institucional conhecido.")).toBeUndefined();
  });
});
