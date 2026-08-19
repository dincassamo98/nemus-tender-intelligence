import { createHash } from "node:crypto";
import { getStorageDriver } from "../storage";

export interface ProcessedDocument {
  storagePath: string;
  fileType: "pdf" | "image" | "html" | "other";
  fileSizeBytes: number;
  documentHash: string;
  extractedText: string | null;
  ocrApplied: boolean;
  ocrStatus: "NOT_NEEDED" | "DONE" | "FAILED";
  parsingStatus: "DONE" | "FAILED";
  errorMessage?: string;
}

const DOWNLOAD_TIMEOUT_MS = 30_000;

function guessFileType(url: string, contentType: string | null): ProcessedDocument["fileType"] {
  const lower = url.toLowerCase();
  if (contentType?.includes("pdf") || lower.endsWith(".pdf")) return "pdf";
  if (contentType?.startsWith("image/") || /\.(png|jpe?g|webp)$/i.test(lower)) return "image";
  if (contentType?.includes("html")) return "html";
  return "other";
}

/**
 * Downloads a document, stores the raw bytes (never discarding the
 * original — spec section 33), and extracts text (with OCR fallback for
 * scanned/image documents). Every failure is captured on the returned
 * object rather than thrown, so one broken document never aborts the whole
 * tender extraction (spec section 30: design for failure).
 */
export async function downloadAndProcessDocument(url: string, tenderId: string, index: number): Promise<ProcessedDocument> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const contentType = res.headers.get("content-type");
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const fileType = guessFileType(url, contentType);
    const documentHash = createHash("sha256").update(buffer).digest("hex");

    const extension = fileType === "pdf" ? "pdf" : fileType === "image" ? "img" : "bin";
    const storagePath = await getStorageDriver().put(`tenders/${tenderId}/doc-${index}-${documentHash.slice(0, 12)}.${extension}`, buffer);

    let extractedText: string | null = null;
    let ocrApplied = false;
    let ocrStatus: ProcessedDocument["ocrStatus"] = "NOT_NEEDED";

    if (fileType === "pdf") {
      try {
        const { default: pdfParse } = await import("pdf-parse");
        const parsed = await pdfParse(buffer);
        extractedText = parsed.text?.trim() || null;
        if (!extractedText || extractedText.length < 40) {
          // Likely a scanned PDF with no text layer.
          const ocrResult = await ocrPdfFallback(buffer);
          extractedText = ocrResult.text;
          ocrApplied = true;
          ocrStatus = ocrResult.text ? "DONE" : "FAILED";
        }
      } catch (err) {
        return {
          storagePath,
          fileType,
          fileSizeBytes: buffer.byteLength,
          documentHash,
          extractedText: null,
          ocrApplied: false,
          ocrStatus: "NOT_NEEDED",
          parsingStatus: "FAILED",
          errorMessage: `PDF parsing failed: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
    } else if (fileType === "image") {
      const ocrResult = await ocrImageFallback(buffer);
      extractedText = ocrResult.text;
      ocrApplied = true;
      ocrStatus = ocrResult.text ? "DONE" : "FAILED";
    }

    return {
      storagePath,
      fileType,
      fileSizeBytes: buffer.byteLength,
      documentHash,
      extractedText,
      ocrApplied,
      ocrStatus,
      parsingStatus: "DONE",
    };
  } catch (err) {
    return {
      storagePath: "",
      fileType: "other",
      fileSizeBytes: 0,
      documentHash: "",
      extractedText: null,
      ocrApplied: false,
      ocrStatus: "NOT_NEEDED",
      parsingStatus: "FAILED",
      errorMessage: `Download failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function ocrImageFallback(buffer: Buffer): Promise<{ text: string | null }> {
  try {
    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker("por");
    const { data } = await worker.recognize(buffer);
    await worker.terminate();
    return { text: data.text?.trim() || null };
  } catch {
    return { text: null };
  }
}

async function ocrPdfFallback(_buffer: Buffer): Promise<{ text: string | null }> {
  // Rendering PDF pages to images for OCR requires a PDF rasterizer
  // (e.g. pdf-to-img / pdfjs canvas rendering), which needs native canvas
  // support. Deliberately not wired in for the MVP to avoid a heavy native
  // dependency until a real scanned-PDF case from a live source proves it's
  // needed — see docs/ARCHITECTURE.md "Known gaps". Text-layer PDFs (the
  // common case for UFSA-published notices) are unaffected.
  return { text: null };
}
