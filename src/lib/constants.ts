import type { ContractType, ServiceCategory } from "./types";

/**
 * Cidade-piloto. A arquitetura é multi-cidade desde o V0 (campo `city` em
 * todas as entidades), mas a UI só abre Sinop até validar o modelo.
 */
export const PILOT_CITY = "Sinop";
export const PILOT_STATE = "MT";
export const PILOT_LABEL = `${PILOT_CITY} - ${PILOT_STATE}`;

/** Cidades já previstas no schema; só a piloto está ativa na UI do V0. */
export const CITIES = [
  { name: "Sinop", state: "MT", active: true },
  { name: "Sorriso", state: "MT", active: false },
  { name: "Lucas do Rio Verde", state: "MT", active: false },
  { name: "Nova Mutum", state: "MT", active: false },
  { name: "Cuiabá", state: "MT", active: false },
] as const;

/** Bairros de Sinop usados nos filtros e no cadastro. */
export const SINOP_NEIGHBORHOODS = [
  "Centro",
  "Jardim Botânico",
  "Jardim Paraíso",
  "Jardim das Palmeiras",
  "Setor Comercial",
  "Setor Industrial",
  "Residencial Florença",
  "Jardim Primavera",
  "Jardim Itália",
  "Menezes",
  "Boa Esperança",
  "Jacarandá",
  "Jardim Celeste",
  "Aquarela Brasil",
] as const;

/** Lista fixa inicial do V0 — expansível sem migração de schema. */
export const SERVICE_CATEGORIES: ServiceCategory[] = [
  { id: 1, slug: "eletricista", name: "Eletricista" },
  { id: 2, slug: "diarista", name: "Diarista" },
  { id: 3, slug: "pintor", name: "Pintor" },
  { id: 4, slug: "encanador", name: "Encanador" },
  { id: 5, slug: "pedreiro", name: "Pedreiro" },
  { id: 6, slug: "jardineiro", name: "Jardineiro" },
  { id: 7, slug: "cuidador", name: "Cuidador(a)" },
];

/** Áreas das vagas CLT — refletem a economia de Sinop (agro, comércio, serviços). */
export const JOB_CATEGORIES = [
  "Agronegócio",
  "Comércio e Vendas",
  "Administrativo",
  "Construção Civil",
  "Logística e Transporte",
  "Indústria e Produção",
  "Saúde",
  "Educação",
  "Alimentação",
  "Tecnologia",
  "Serviços Gerais",
] as const;

export const CONTRACT_TYPES: ContractType[] = [
  "CLT",
  "Estágio",
  "Temporário",
  "Freelance",
  "Jovem Aprendiz",
];

export const ROLE_LABELS = {
  candidato_clt: "Candidato",
  prestador_servico: "Prestador de serviço",
  empresa: "Empresa",
} as const;

export const VERIFICATION_LABELS = {
  pendente: "Pendente",
  em_analise: "Em análise",
  aprovado: "Aprovado",
  reprovado: "Reprovado",
} as const;

export const APPLICATION_LABELS = {
  enviada: "Enviada",
  visualizada: "Visualizada",
  entrevista: "Entrevista",
  aprovada: "Aprovada",
  rejeitada: "Não selecionado",
} as const;
