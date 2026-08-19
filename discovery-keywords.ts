/**
 * Broad discovery keyword list (spec section 6). This is intentionally wide —
 * it decides whether a block of text from a source is even considered a
 * candidate announcement worth extracting. Precision is the classifier's job
 * (lib/intelligence/classifier.ts), not this list's. Favor recall here.
 */
export const DISCOVERY_KEYWORDS: string[] = [
  // Procurement process terms (PT)
  "concurso",
  "concurso público",
  "concurso limitado",
  "concurso por lances",
  "aquisição",
  "contratação",
  "prestação de serviços",
  "consultoria",
  "manifestação de interesse",
  "solicitação de propostas",
  "convite",
  "adjudicação",
  "termos de referência",
  // Procurement process terms (EN)
  "request for proposals",
  "request for quotations",
  "procurement",
  "expression of interest",
  "invitation to bid",
  "invitation to tender",
  // Subject-matter terms likely to co-occur with environmental/sustainability work
  "estudos",
  "avaliação",
  "auditoria",
  "ambiente",
  "ambiental",
  "sustentabilidade",
  "gestão ambiental",
  "impacto ambiental",
  "recursos naturais",
  "biodiversidade",
  "alterações climáticas",
  "resíduos",
  "água",
  "energia",
  "conservação",
  "desenvolvimento sustentável",
  "ordenamento territorial",
  "florestas",
  "agricultura",
  "reassentamento",
];

export function looksLikeAnnouncement(text: string): boolean {
  const normalized = text.toLowerCase();
  return DISCOVERY_KEYWORDS.some((kw) => normalized.includes(kw.toLowerCase()));
}
