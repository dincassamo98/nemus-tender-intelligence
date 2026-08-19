/**
 * Source adapter contract. Every procurement source (Jornal Notícias, UFSA,
 * a future World Bank/AfDB adapter, ...) implements this interface and
 * nothing else in the codebase needs to know how that source actually works.
 * See docs/ADDING_A_SOURCE.md for how to add a new one.
 */

export interface RawDocument {
  url: string;
  label?: string;
  fileTypeHint?: "pdf" | "image" | "html" | "other";
}

/**
 * A single tender-like item as discovered by an adapter, before dedup,
 * classification, or persistence. Every field the adapter is confident about
 * should be filled; leave unknown fields undefined rather than guessing —
 * the pipeline records provenance per field, so guesses must be flagged as
 * such via `inferredFields`, never presented as confirmed.
 */
export interface RawAnnouncement {
  externalRef?: string;
  organizationRaw: string;
  title: string;
  description: string;
  sourceUrl: string;
  announcementUrl?: string;
  geography?: string;
  estimatedValue?: number;
  currency?: string;
  contractDuration?: string;
  procurementMethod?: string;
  tenderType?: string;
  categoryTags?: string[];

  publicationDate?: Date;
  sourcePublicationDate?: Date;
  deadline?: Date;
  clarificationDeadline?: Date;
  submissionDeadline?: Date;
  openingDate?: Date;

  eligibilityRequirements?: string[];
  requiredQualifications?: string[];
  requiredExperience?: string[];
  requiredDocuments?: string[];
  financialRequirements?: string;
  technicalRequirements?: string;

  documents?: RawDocument[];

  /** e.g. "Jornal Notícias — Edição 19 Ago 2026 — Página 14" — shown verbatim in the UI's provenance panel */
  sourceDescription: string;

  /** Field names this adapter is not fully confident about (e.g. derived from OCR guesswork) */
  inferredFields?: string[];

  /** Links this announcement to a specific Edition record, for edition-based sources */
  editionExternalId?: string;
}

export interface RawEdition {
  externalId: string;
  publicationDate: Date;
  url: string;
  pageCount?: number;
}

export type AdapterEvent =
  | { type: "log"; message: string }
  | { type: "edition_discovered"; edition: RawEdition }
  | { type: "announcement"; announcement: RawAnnouncement }
  | { type: "error"; message: string; fatal?: boolean };

export interface AdapterRunContext {
  /** Parsed Source.config JSON (lookback days, section keywords, etc.) */
  config: Record<string, unknown>;
  /** Resolved credentials from environment variables — never logged, never persisted */
  credentials: Record<string, string | undefined>;
  lookbackDays: number;
}

export interface SourceAdapter {
  /** Must match the Source.adapterKey value in the database */
  key: string;
  name: string;
  requiresAuth: boolean;
  isDemo?: boolean;
  /**
   * Status of live validation against the real source. Adapters built
   * without network access to the real site during development are marked
   * NEEDS_VALIDATION until someone runs them against production with real
   * credentials/network and confirms extraction quality — never silently
   * assumed correct.
   */
  validationStatus: "VALIDATED" | "NEEDS_VALIDATION";
  run(ctx: AdapterRunContext): AsyncGenerator<AdapterEvent>;
}
