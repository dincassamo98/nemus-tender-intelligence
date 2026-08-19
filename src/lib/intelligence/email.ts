export type EmailPurpose = "CLARIFICATION" | "REQUEST_DOCUMENTS" | "EXPRESS_INTEREST" | "ELIGIBILITY" | "OTHER";

export interface EmailDraftInput {
  tenderTitle: string;
  organizationRaw: string;
  externalRef: string | null;
  deadline: Date | null;
  sourceUrl: string;
  senderName: string;
}

export interface GeneratedEmail {
  subject: string;
  body: string;
  groundedFields: string[]; // which tender fields fed this draft — shown in the UI for traceability
}

function formatDeadline(d: Date | null): string {
  return d ? d.toLocaleDateString("pt-PT", { day: "2-digit", month: "long", year: "numeric" }) : "não especificado no anúncio";
}

/**
 * Template-based email generation, grounded strictly in fields already
 * stored on the tender (spec section 23: "the system should NOT fabricate
 * information"). No LLM call is made — every sentence traces to a specific
 * field, listed in groundedFields, and the compose UI always opens the draft
 * for editing before anything is sent (spec section 24).
 */
export function generateEmailDraft(purpose: EmailPurpose, input: EmailDraftInput): GeneratedEmail {
  const refLine = input.externalRef ? ` (Ref.ª ${input.externalRef})` : "";
  const subjectBase = `${input.tenderTitle}${refLine}`;
  const groundedFields = ["tenderTitle", "organizationRaw", "externalRef", "deadline", "sourceUrl"];

  const closing = `\n\nCom os melhores cumprimentos,\n${input.senderName}\nNemus África`;
  const opening = `Exmos. Senhores,\n\n`;
  const reference = `Relativamente ao concurso "${input.tenderTitle}"${refLine}, publicado por ${input.organizationRaw} (prazo indicado: ${formatDeadline(input.deadline)}), vimos por este meio solicitar o seguinte:\n\n`;

  switch (purpose) {
    case "CLARIFICATION":
      return {
        subject: `Pedido de esclarecimento — ${subjectBase}`,
        body:
          opening +
          reference +
          "Solicitamos esclarecimento adicional sobre [especifique aqui o ponto concreto do anúncio que requer clarificação — por exemplo, âmbito técnico, critérios de avaliação, ou prazos]. " +
          "Agradecemos que nos indiquem o procedimento correcto para submeter perguntas de esclarecimento dentro do prazo estabelecido." +
          closing,
        groundedFields,
      };
    case "REQUEST_DOCUMENTS":
      return {
        subject: `Solicitação de documentos do concurso — ${subjectBase}`,
        body:
          opening +
          reference +
          "Solicitamos o envio (ou indicação de onde obter) o caderno de encargos completo, termos de referência e quaisquer anexos técnicos associados a este concurso, uma vez que o anúncio consultado não disponibilizou a documentação completa." +
          closing,
        groundedFields,
      };
    case "EXPRESS_INTEREST":
      return {
        subject: `Manifestação de interesse — ${subjectBase}`,
        body:
          opening +
          reference +
          "A Nemus África vem por este meio manifestar o seu interesse em participar neste concurso, tendo em conta a nossa experiência relevante na área. " +
          "Agradecemos a confirmação de recepção desta manifestação de interesse e informação sobre os próximos passos do processo." +
          closing,
        groundedFields,
      };
    case "ELIGIBILITY":
      return {
        subject: `Questão sobre elegibilidade — ${subjectBase}`,
        body:
          opening +
          reference +
          "Solicitamos confirmação sobre se [especifique aqui o critério de elegibilidade em questão — por exemplo, requisitos de registo local, parcerias/consórcios, ou experiência mínima exigida] se aplica à nossa organização, de forma a assegurarmos que reunimos as condições de participação antes de prepararmos a proposta." +
          closing,
        groundedFields,
      };
    case "OTHER":
    default:
      return {
        subject: subjectBase,
        body: opening + reference + "[Escreva aqui o conteúdo específico da sua mensagem.]" + closing,
        groundedFields,
      };
  }
}
