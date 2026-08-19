import type { AdapterEvent, AdapterRunContext, SourceAdapter, RawAnnouncement } from "./types";

/**
 * Synthetic but realistic demo data so the platform is immediately useful
 * and demonstrable before live credentials/network access are available
 * (spec section 50). Every record produced by this adapter is clearly
 * tagged — Source.isDemo=true propagates to Tender.source.isDemo, and the
 * UI renders a persistent "Demo data" badge so it can never be mistaken for
 * a real discovered opportunity.
 */

function daysFromNow(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

function demoAnnouncements(): RawAnnouncement[] {
  return [
    {
      externalRef: "MICOA/DNAAS/012/2026",
      organizationRaw: "Ministério da Terra e Ambiente — Direcção Nacional de Avaliação de Impacto Ambiental",
      title: "Concurso para Consultoria em Avaliação de Impacto Ambiental e Social — Corredor de Nacala",
      description:
        "O Ministério da Terra e Ambiente pretende contratar uma empresa de consultoria para a realização do Estudo de Impacto Ambiental e Social (EIAS) relativo à reabilitação do corredor de transporte de Nacala, incluindo avaliação de impacto cumulativo, plano de gestão ambiental e consulta pública às comunidades afectadas.",
      sourceUrl: "https://flipbook-snoticias.app.co.mz/edicao/2026-08-18",
      announcementUrl: "https://flipbook-snoticias.app.co.mz/edicao/2026-08-18#pagina-14",
      geography: "Nampula, Moçambique",
      currency: "MZN",
      procurementMethod: "Concurso Público",
      tenderType: "Consultoria",
      publicationDate: daysFromNow(-1),
      sourcePublicationDate: daysFromNow(-1),
      deadline: daysFromNow(26),
      submissionDeadline: daysFromNow(26),
      clarificationDeadline: daysFromNow(12),
      eligibilityRequirements: [
        "Empresa registada em Moçambique ou consórcio com parceiro local",
        "Mínimo de 5 anos de experiência em AIAS na região da SADC",
      ],
      requiredQualifications: [
        "Equipa técnica com especialistas em ecologia, hidrologia e ciências sociais",
        "Certificação ISO 14001 (preferencial)",
      ],
      requiredDocuments: [
        "Proposta técnica",
        "Proposta financeira",
        "Certidão de registo comercial",
        "Comprovativo de situação fiscal regularizada",
        "CVs da equipa-chave",
      ],
      documents: [
        { url: "https://flipbook-snoticias.app.co.mz/docs/demo-tor-nacala.pdf", label: "Termos de Referência", fileTypeHint: "pdf" },
      ],
      sourceDescription: "Demo data — Jornal Notícias, Edição 18 Ago 2026, Página 14",
    },
    {
      externalRef: "CMM/UGEA/034/2026",
      organizationRaw: "Conselho Municipal de Maputo",
      title: "Manifestação de Interesse — Plano de Gestão de Resíduos Sólidos Urbanos",
      description:
        "O Conselho Municipal de Maputo convida empresas de consultoria qualificadas a manifestar interesse na elaboração de um plano director de gestão de resíduos sólidos urbanos, incluindo diagnóstico da situação actual, opções de valorização de resíduos e proposta de modelo de gestão sustentável.",
      sourceUrl: "https://www.ufsa.gov.mz/concursos.php",
      announcementUrl: "https://www.ufsa.gov.mz/concursos.php?id=demo-034",
      geography: "Maputo, Moçambique",
      currency: "MZN",
      procurementMethod: "Manifestação de Interesse",
      tenderType: "Consultoria",
      publicationDate: daysFromNow(-3),
      sourcePublicationDate: daysFromNow(-3),
      deadline: daysFromNow(9),
      submissionDeadline: daysFromNow(9),
      eligibilityRequirements: ["Experiência comprovada em gestão de resíduos sólidos em contexto urbano africano"],
      requiredQualifications: ["Equipa com especialista em engenharia ambiental"],
      requiredDocuments: ["Carta de manifestação de interesse", "Perfil da empresa", "Referências de projectos similares"],
      sourceDescription: "Demo data — UFSA, Portal de Concursos Públicos (concursos.php)",
    },
    {
      externalRef: "WB-P178942-CS-QCBS-07",
      organizationRaw: "Banco Mundial — Projecto de Resiliência Climática de Moçambique",
      title: "Request for Expressions of Interest — Climate Vulnerability and Adaptation Assessment, Zambezia Province",
      description:
        "The World Bank-financed Mozambique Climate Resilience Project is seeking a qualified firm to conduct a climate vulnerability and adaptation assessment for coastal and riverine communities in Zambézia Province, including hydrological modelling and community-based adaptation planning.",
      sourceUrl: "https://projects.worldbank.org/en/projects-operations/procurement",
      geography: "Zambézia, Moçambique",
      currency: "USD",
      procurementMethod: "QCBS",
      tenderType: "Consultoria",
      publicationDate: daysFromNow(-5),
      sourcePublicationDate: daysFromNow(-5),
      deadline: daysFromNow(3),
      submissionDeadline: daysFromNow(3),
      eligibilityRequirements: ["Firm or JV with prior climate adaptation project experience in Sub-Saharan Africa"],
      requiredDocuments: ["Expression of interest", "Firm profile", "CVs of key experts"],
      sourceDescription: "Demo data — World Bank Projects & Operations (procurement notices)",
    },
    {
      externalRef: "DPOPHRH-ZAM-021/2026",
      organizationRaw: "Direcção Provincial das Obras Públicas, Habitação e Recursos Hídricos — Zambézia",
      title: "Concurso Público para Construção de Escola Primária em Mocuba",
      description:
        "Concurso público para empreitada de construção de uma escola primária completa com 6 salas de aula, bloco administrativo e sanitários, no distrito de Mocuba, Zambézia.",
      sourceUrl: "https://flipbook-snoticias.app.co.mz/edicao/2026-08-15",
      geography: "Mocuba, Zambézia",
      currency: "MZN",
      procurementMethod: "Concurso Público",
      tenderType: "Empreitada de Obras",
      publicationDate: daysFromNow(-4),
      sourcePublicationDate: daysFromNow(-4),
      deadline: daysFromNow(20),
      requiredDocuments: ["Alvará de construção civil", "Proposta técnica e financeira"],
      sourceDescription: "Demo data — Jornal Notícias, Edição 15 Ago 2026, Página 22",
    },
    {
      externalRef: "MOP-SUP-011/2026",
      organizationRaw: "Ministério das Obras Públicas — Direcção Nacional de Águas",
      title: "Fornecimento de Material de Escritório para Delegações Provinciais",
      description:
        "Concurso para o fornecimento e entrega de material de escritório diverso (papel, tinteiros, consumíveis) para as delegações provinciais da Direcção Nacional de Águas durante o exercício de 2026/2027.",
      sourceUrl: "https://flipbook-snoticias.app.co.mz/edicao/2026-08-12",
      geography: "Moçambique",
      currency: "MZN",
      procurementMethod: "Concurso Público",
      tenderType: "Fornecimento de Bens",
      publicationDate: daysFromNow(-8),
      sourcePublicationDate: daysFromNow(-8),
      deadline: daysFromNow(2),
      sourceDescription: "Demo data — Jornal Notícias, Edição 12 Ago 2026, Página 19",
    },
    {
      organizationRaw: "Empresa Privada de Telecomunicações",
      title: "Aviso de Leilão de Equipamento Informático Obsoleto",
      description: "Leilão público de equipamento informático obsoleto (computadores, impressoras) fora de uso.",
      sourceUrl: "https://flipbook-snoticias.app.co.mz/edicao/2026-08-10",
      geography: "Maputo",
      currency: "MZN",
      publicationDate: daysFromNow(-10),
      sourcePublicationDate: daysFromNow(-10),
      deadline: daysFromNow(-2),
      sourceDescription: "Demo data — Jornal Notícias, Edição 10 Ago 2026, Página 27",
    },
  ];
}

export const demoAdapter: SourceAdapter = {
  key: "demo",
  name: "Demo Data (synthetic)",
  requiresAuth: false,
  isDemo: true,
  validationStatus: "VALIDATED",
  async *run(_ctx: AdapterRunContext): AsyncGenerator<AdapterEvent> {
    yield { type: "log", message: "Loading synthetic demo dataset (no live source contacted)." };
    for (const announcement of demoAnnouncements()) {
      yield { type: "announcement", announcement };
    }
    yield { type: "log", message: `Demo dataset loaded: ${demoAnnouncements().length} announcements.` };
  },
};
