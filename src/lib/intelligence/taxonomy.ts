import { diceCoefficient, normalizeForMatching } from "../pipeline/similarity";

/**
 * Canonical procurement-opportunity taxonomy (spec: "SOURCE TAXONOMY").
 * Different sources never agree on terminology — a UN agency says
 * "Request for Proposal", a Mozambican newspaper says "Anúncio de
 * Concurso", a ministry says "Pedido de Manifestação de Interesse". None of
 * that should matter to the rest of the pipeline: every adapter maps
 * whatever term it finds onto one of these canonical types, so an
 * opportunity is never under-valued just because a source never uses the
 * word "concurso".
 */
export type CanonicalOpportunityType =
  | "ANUNCIO_CONCURSO"
  | "CONCURSO_PUBLICO"
  | "CONCURSO_LIMITADO"
  | "PEDIDO_MANIFESTACAO_INTERESSE"
  | "EXPRESSION_OF_INTEREST"
  | "REQUEST_FOR_PROPOSAL"
  | "REQUEST_FOR_QUOTATION"
  | "INVITATION_TO_BID"
  | "PROCUREMENT_NOTICE"
  | "CALL_FOR_PROPOSALS"
  | "CONSULTANCY"
  | "OTHER";

interface TaxonomyEntry {
  type: CanonicalOpportunityType;
  label: string;
  keywordsPt: string[];
  keywordsEn: string[];
}

export const OPPORTUNITY_TAXONOMY: TaxonomyEntry[] = [
  {
    type: "ANUNCIO_CONCURSO",
    label: "Anúncio de Concurso",
    keywordsPt: ["anúncio de concurso", "anuncio de concurso", "anúncio concurso", "aviso de concurso"],
    keywordsEn: [],
  },
  {
    type: "CONCURSO_PUBLICO",
    label: "Concurso Público",
    keywordsPt: ["concurso público", "concurso publico"],
    keywordsEn: [],
  },
  {
    type: "CONCURSO_LIMITADO",
    label: "Concurso Limitado",
    keywordsPt: ["concurso limitado", "concurso por lances"],
    keywordsEn: [],
  },
  {
    type: "PEDIDO_MANIFESTACAO_INTERESSE",
    label: "Pedido de Manifestação de Interesse",
    keywordsPt: [
      "pedido de manifestação de interesse",
      "pedido de manifestacao de interesse",
      "manifestação de interesse",
      "manifestacao de interesse",
    ],
    keywordsEn: ["expression of interest", "request for expression of interest", "eoi"],
  },
  {
    type: "EXPRESSION_OF_INTEREST",
    label: "Expression of Interest",
    keywordsPt: [],
    keywordsEn: ["expression of interest", "eoi", "call for expressions of interest"],
  },
  {
    type: "REQUEST_FOR_PROPOSAL",
    label: "Request for Proposal",
    keywordsPt: ["solicitação de propostas", "solicitacao de propostas"],
    keywordsEn: ["request for proposal", "request for proposals", "rfp"],
  },
  {
    type: "REQUEST_FOR_QUOTATION",
    label: "Request for Quotation",
    keywordsPt: ["pedido de cotação", "pedido de cotacao"],
    keywordsEn: ["request for quotation", "request for quotations", "rfq"],
  },
  {
    type: "INVITATION_TO_BID",
    label: "Invitation to Bid",
    keywordsPt: ["convite à apresentação de propostas"],
    keywordsEn: ["invitation to bid", "invitation to tender", "itb", "itt"],
  },
  {
    type: "PROCUREMENT_NOTICE",
    label: "Procurement Notice",
    keywordsPt: ["aviso de aquisição", "aviso de aquisicao"],
    keywordsEn: ["procurement notice", "tender notice"],
  },
  {
    type: "CALL_FOR_PROPOSALS",
    label: "Call for Proposals",
    keywordsPt: ["chamada de propostas"],
    keywordsEn: ["call for proposals", "call for applications"],
  },
  {
    type: "CONSULTANCY",
    label: "Consultancy Opportunity",
    keywordsPt: ["prestação de serviços", "prestacao de servicos", "consultoria", "serviços de consultoria", "consulta"],
    keywordsEn: ["consultancy", "consulting services", "individual consultant", "institutional consultant"],
  },
];

/**
 * Returns every canonical type whose terminology appears in the given text.
 * An announcement can legitimately match more than one (e.g. a "Pedido de
 * Manifestação de Interesse" for "Serviços de Consultoria" matches both).
 */
export function classifyOpportunityTypes(text: string): CanonicalOpportunityType[] {
  const normalized = normalizeForMatching(text);
  const matches: CanonicalOpportunityType[] = [];
  for (const entry of OPPORTUNITY_TAXONOMY) {
    const allTerms = [...entry.keywordsPt, ...entry.keywordsEn];
    if (allTerms.some((term) => normalized.includes(normalizeForMatching(term)))) {
      matches.push(entry.type);
    }
  }
  return matches.length > 0 ? matches : ["OTHER"];
}

/**
 * Jornal Notícias' two priority sections (spec: "PRIMARY DISCOVERY
 * SECTIONS"). OCR output on a scanned newspaper page is noisy — capitalization,
 * missing accents, and misread characters are all expected — so this uses
 * fuzzy matching (not exact substring) against known section header
 * variants, tolerant of the kind of drift OCR actually produces.
 */
export const PRIORITY_SECTION_HEADERS = [
  "Pedido de Manifestação de Interesse",
  "Pedido de Manifestacao de Interesse",
  "Manifestação de Interesse",
  "Manifestações de Interesse",
  "Anúncio de Concurso",
  "Anuncio de Concurso",
  "Anúncios de Concurso",
  "Anúncio Concurso",
];

const SECTION_HEADER_MATCH_THRESHOLD = 0.55;

/**
 * Scans a block of (possibly OCR'd) page text for lines that look like one
 * of the priority section headers, even with OCR noise. Returns the
 * best-matching header label if the line clears the fuzzy-match threshold,
 * otherwise null. Headers are typically short, standalone lines (not
 * embedded mid-paragraph), so only lines under ~60 chars are considered —
 * keeps this from matching the phrase deep inside unrelated body text,
 * which the discovery-keyword scan already covers separately.
 */
export function detectPrioritySectionHeader(line: string): { header: string; score: number } | null {
  const trimmed = line.trim();
  if (trimmed.length < 8 || trimmed.length > 60) return null;

  let best: { header: string; score: number } | null = null;
  for (const header of PRIORITY_SECTION_HEADERS) {
    const score = diceCoefficient(normalizeForMatching(trimmed), normalizeForMatching(header));
    if (score >= SECTION_HEADER_MATCH_THRESHOLD && (!best || score > best.score)) {
      best = { header, score };
    }
  }
  return best;
}
