/**
 * Structured representation of Nemus África's mission, capabilities and
 * geographic focus, used by the relevance classifier (lib/intelligence/classifier.ts).
 *
 * Sourced from public information about Nemus (nemus.pt) and Nemus África:
 * an international environmental consultancy founded in Portugal, present in
 * 14 countries (incl. Mozambique, Angola, Zambia, South Africa, Rwanda).
 * Nemus África was established in 2016, headquartered in Maputo. Its three
 * core domains are Environment, Progress & Public Policies, and
 * Sustainability. Known project history includes Environmental & Social
 * Impact Assessments (transport infrastructure, e.g. Maputo's ring road),
 * Strategic Environmental Assessments, cumulative impact assessments for
 * ministries of transport (Mozambique, Malawi), municipal pollution-control
 * programs, and donor-funded forest-carbon/REDD+ work (World Bank/FCPF).
 *
 * This file is intentionally editable data, not code logic — as Nemus África's
 * real service catalogue, past projects and target sectors become available
 * (ideally from an internal source rather than public web research), replace
 * the placeholders below. Keeping this as a single structured file, rather
 * than scattering keywords through the classifier, is what lets the
 * classifier improve without a rewrite (spec section 8).
 */

export interface NemusProfile {
  mission: string;
  coreDomains: string[];
  serviceAreas: {
    name: string;
    keywordsPt: string[];
    keywordsEn: string[];
    weight: number; // relative importance 0-1, used by the classifier
  }[];
  preferredClientTypes: string[];
  geographicFocus: {
    primary: string[];
    secondary: string[];
  };
  pastProjectSignals: string[]; // free-text signals that indicate strong historical fit
}

export const NEMUS_PROFILE: NemusProfile = {
  mission:
    "Nemus África provides environmental and sustainability consulting, engineering studies and supervision, and public-policy advisory services across Mozambique and Southern/Eastern Africa, as part of the wider Nemus international consultancy group.",
  coreDomains: ["Environment", "Progress & Public Policies", "Sustainability"],
  serviceAreas: [
    {
      name: "Environmental & Social Impact Assessment",
      keywordsPt: [
        "avaliação de impacto ambiental",
        "avaliação de impacto ambiental e social",
        "aia",
        "eias",
        "eas",
        "estudo de impacto ambiental",
        "estudo ambiental simplificado",
        "avaliação ambiental estratégica",
        "aae",
        "licenciamento ambiental",
        "auditoria ambiental",
      ],
      keywordsEn: [
        "environmental impact assessment",
        "environmental and social impact assessment",
        "esia",
        "strategic environmental assessment",
        "environmental audit",
        "environmental licensing",
      ],
      weight: 1.0,
    },
    {
      name: "Environmental Management & Monitoring",
      keywordsPt: [
        "gestão ambiental",
        "plano de gestão ambiental",
        "monitoria ambiental",
        "monitorização ambiental",
        "avaliação e revisão de programas ambientais",
        "resíduos sólidos",
        "gestão de resíduos",
        "qualidade do ar",
        "qualidade da água",
        "poluição",
      ],
      keywordsEn: [
        "environmental management",
        "environmental management plan",
        "environmental monitoring",
        "waste management",
        "solid waste",
        "air quality",
        "water quality",
        "pollution control",
      ],
      weight: 0.95,
    },
    {
      name: "Natural Resources, Biodiversity & Conservation",
      keywordsPt: [
        "recursos naturais",
        "biodiversidade",
        "conservação",
        "áreas de conservação",
        "florestas",
        "desmatamento",
        "redd+",
        "carbono florestal",
        "fauna e flora",
        "ecossistemas",
      ],
      keywordsEn: [
        "natural resources",
        "biodiversity",
        "conservation",
        "forestry",
        "deforestation",
        "forest carbon",
        "redd+",
        "ecosystems",
        "wildlife",
      ],
      weight: 0.95,
    },
    {
      name: "Climate Change & Resilience",
      keywordsPt: [
        "alterações climáticas",
        "mudanças climáticas",
        "adaptação climática",
        "resiliência climática",
        "vulnerabilidade climática",
        "energias renováveis",
      ],
      keywordsEn: [
        "climate change",
        "climate adaptation",
        "climate resilience",
        "climate vulnerability",
        "renewable energy",
      ],
      weight: 0.9,
    },
    {
      name: "Water Resources",
      keywordsPt: ["recursos hídricos", "gestão da água", "saneamento", "abastecimento de água", "bacias hidrográficas"],
      keywordsEn: ["water resources", "water management", "sanitation", "water supply", "river basin"],
      weight: 0.85,
    },
    {
      name: "Sustainable Development & ESG",
      keywordsPt: [
        "desenvolvimento sustentável",
        "sustentabilidade",
        "responsabilidade social",
        "reassentamento",
        "plano de reassentamento",
        "ordenamento territorial",
        "planeamento territorial",
      ],
      keywordsEn: [
        "sustainable development",
        "sustainability",
        "esg",
        "resettlement",
        "resettlement action plan",
        "rap",
        "territorial planning",
        "land use planning",
      ],
      weight: 0.9,
    },
    {
      name: "Public Policy & Institutional Advisory",
      keywordsPt: [
        "políticas públicas",
        "assistência técnica",
        "reforço institucional",
        "capacitação institucional",
        "governação",
      ],
      keywordsEn: ["public policy", "technical assistance", "institutional strengthening", "capacity building", "governance"],
      weight: 0.7,
    },
    {
      name: "Infrastructure & Engineering Studies (with environmental component)",
      keywordsPt: [
        "estudo de viabilidade",
        "supervisão de obras",
        "infraestruturas de transporte",
        "estradas",
        "portos",
        "energia",
        "linhas de transmissão",
        "consultoria de engenharia",
      ],
      keywordsEn: [
        "feasibility study",
        "works supervision",
        "transport infrastructure",
        "roads",
        "ports",
        "energy",
        "transmission lines",
        "engineering consultancy",
      ],
      weight: 0.6,
    },
    {
      name: "General Consulting Services & Procurement Signals",
      keywordsPt: [
        "concurso público",
        "concurso limitado",
        "manifestação de interesse",
        "aquisição de serviços",
        "contratação de serviços",
        "prestação de serviços",
        "consultoria",
        "termos de referência",
        "solicitação de propostas",
      ],
      keywordsEn: [
        "request for proposals",
        "rfp",
        "request for quotations",
        "rfq",
        "expression of interest",
        "eoi",
        "terms of reference",
        "tor",
        "consulting services",
        "procurement notice",
      ],
      weight: 0.35, // procurement-process words alone are weak signals; they gate recall, not relevance
    },
  ],
  preferredClientTypes: [
    "ministério",
    "ministry",
    "município",
    "municipality",
    "conselho municipal",
    "governo provincial",
    "banco mundial",
    "world bank",
    "banco africano de desenvolvimento",
    "african development bank",
    "afdb",
    "pnud",
    "undp",
    "usaid",
    "união europeia",
    "european union",
    "giz",
    "agência de cooperação",
    "ong",
    "ngo",
    "empresa pública",
    "public company",
  ],
  geographicFocus: {
    primary: ["moçambique", "mozambique", "maputo"],
    secondary: [
      "angola",
      "zâmbia",
      "zambia",
      "áfrica do sul",
      "south africa",
      "ruanda",
      "rwanda",
      "malawi",
      "áfrica austral",
      "southern africa",
    ],
  },
  pastProjectSignals: [
    "cumulative impact assessment",
    "avaliação de impacto cumulativo",
    "circular rodoviária",
    "ring road",
    "corredor de transporte",
    "transport corridor",
    "programa de desenvolvimento municipal",
    "municipal development programme",
  ],
};
