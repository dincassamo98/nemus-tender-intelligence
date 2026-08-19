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
  "anúncio de concurso",
  "aquisição",
  "contratação",
  "prestação de serviços",
  "consultoria",
  "pedido de manifestação de interesse",
  "manifestação de interesse",
  "solicitação de propostas",
  "pedido de cotação",
  "convite",
  "convite à apresentação de propostas",
  "adjudicação",
  "termos de referência",
  "chamada de propostas",
  // Procurement process terms (EN) — needed because international
  // organizations (UN agencies, development banks) rarely say "concurso"
  "request for proposals",
  "request for quotations",
  "procurement",
  "procurement notice",
  "expression of interest",
  "call for expressions of interest",
  "call for proposals",
  "invitation to bid",
  "invitation to tender",
  "individual consultant",
  "institutional consultant",
  "consulting services",
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
