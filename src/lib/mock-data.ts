/**
 * Dados de demonstração de Sinop-MT.
 *
 * Servem para o app rodar e ser demonstrado antes do Supabase existir.
 * Assim que `NEXT_PUBLIC_SUPABASE_URL` e a chave anônima estiverem no
 * ambiente, a camada de dados (src/lib/data.ts) passa a ler do banco e
 * este arquivo deixa de ser usado. Um subconjunto equivalente está em
 * supabase/seed.sql, para o ambiente de desenvolvimento local.
 */

import { SERVICE_CATEGORIES } from "./constants";
import type { ApplicationWithCandidate, Company, JobListing, ProviderListing, Review } from "./types";

const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();
const daysAgo = (d: number) => hoursAgo(d * 24);

const cat = (slug: string) => SERVICE_CATEGORIES.find((c) => c.slug === slug)!;

/* ============================================================
   Empresas
   ============================================================ */

export const MOCK_COMPANIES: (Company & { doc_verified: boolean })[] = [
  {
    profile_id: "cmp-agro-norte",
    company_name: "Agro Norte Ltda.",
    cnpj: "12.345.678/0001-90",
    logo_url: `/avatares/cmp-agro-norte.svg`,
    plan: "mensal",
    doc_verified: true,
  },
  {
    profile_id: "cmp-comercial-sinop",
    company_name: "Comercial Sinop",
    cnpj: "23.456.789/0001-01",
    logo_url: `/avatares/cmp-comercial-sinop.svg`,
    plan: "trial",
    doc_verified: true,
  },
  {
    profile_id: "cmp-casa-construcao",
    company_name: "Casa & Construção",
    cnpj: "34.567.890/0001-12",
    logo_url: `/avatares/cmp-casa-construcao.svg`,
    plan: "mensal",
    doc_verified: true,
  },
  {
    profile_id: "cmp-bom-preco",
    company_name: "Supermercado Bom Preço",
    cnpj: "45.678.901/0001-23",
    logo_url: `/avatares/cmp-bom-preco.svg`,
    plan: "trial",
    doc_verified: false,
  },
  {
    profile_id: "cmp-transportes-brasil",
    company_name: "Transportes Brasil",
    cnpj: "56.789.012/0001-34",
    logo_url: `/avatares/cmp-transportes-brasil.svg`,
    plan: "mensal",
    doc_verified: true,
  },
  {
    profile_id: "cmp-clinica-vida",
    company_name: "Clínica Vida Sinop",
    cnpj: "67.890.123/0001-45",
    logo_url: `/avatares/cmp-clinica-vida.svg`,
    plan: "trial",
    doc_verified: true,
  },
];

/** A empresa "logada" no painel Minha Empresa durante a demonstração. */
export const DEMO_COMPANY_ID = "cmp-agro-norte";

const companyRef = (id: string) => {
  const c = MOCK_COMPANIES.find((x) => x.profile_id === id)!;
  return {
    company_name: c.company_name,
    logo_url: c.logo_url,
    doc_verified: c.doc_verified,
  };
};

/* ============================================================
   Vagas
   ============================================================ */

export const MOCK_JOBS: JobListing[] = [
  {
    id: "job-operador-maquinas",
    company_id: "cmp-agro-norte",
    title: "Operador de Máquinas Agrícolas",
    description:
      "Operação de colheitadeiras e tratores em lavoura de soja e milho. " +
      "Responsável pela regulagem do equipamento, checagem diária de óleo e " +
      "filtros, e registro de horas trabalhadas.\n\n" +
      "Requisitos: CNH categoria C, experiência comprovada com colheitadeira, " +
      "disponibilidade para trabalhar em fazenda durante a safra.\n\n" +
      "Oferecemos: alojamento na fazenda, alimentação, transporte de Sinop até " +
      "a propriedade e adicional de safra.",
    category: "Agronegócio",
    city: "Sinop",
    neighborhood: "Setor Industrial",
    contract_type: "CLT",
    salary_min: 3200,
    salary_max: 4200,
    skills: ["Colheitadeira", "Trator", "Manutenção básica"],
    status: "aberta",
    created_at: hoursAgo(2),
    company: companyRef("cmp-agro-norte"),
    applicant_count: 15,
  },
  {
    id: "job-auxiliar-adm",
    company_id: "cmp-comercial-sinop",
    title: "Auxiliar Administrativo",
    description:
      "Rotinas administrativas do escritório: emissão de notas fiscais, " +
      "controle de contas a pagar e receber, atendimento telefônico e " +
      "organização de documentos.\n\n" +
      "Requisitos: ensino médio completo, pacote Office intermediário, " +
      "boa comunicação escrita.\n\n" +
      "Horário comercial, de segunda a sexta. Vale-transporte e vale-refeição.",
    category: "Administrativo",
    city: "Sinop",
    neighborhood: "Centro",
    contract_type: "CLT",
    salary_min: 1800,
    salary_max: 2200,
    skills: ["Excel", "Atendimento ao cliente", "Organização"],
    status: "aberta",
    created_at: hoursAgo(4),
    company: companyRef("cmp-comercial-sinop"),
    applicant_count: 31,
  },
  {
    id: "job-vendedor-interno",
    company_id: "cmp-casa-construcao",
    title: "Vendedor Interno — Material de Construção",
    description:
      "Atendimento a clientes na loja, elaboração de orçamentos, fechamento " +
      "de vendas e acompanhamento de pedidos até a entrega.\n\n" +
      "Requisitos: experiência em vendas no varejo (desejável no ramo de " +
      "construção), facilidade com números.\n\n" +
      "Salário fixo mais comissão sobre vendas, sem teto.",
    category: "Comércio e Vendas",
    city: "Sinop",
    neighborhood: "Setor Comercial",
    contract_type: "CLT",
    salary_min: 1600,
    salary_max: null,
    skills: ["Vendas", "Atendimento ao cliente", "Excel"],
    status: "aberta",
    created_at: hoursAgo(6),
    company: companyRef("cmp-casa-construcao"),
    applicant_count: 12,
  },
  {
    id: "job-operador-caixa",
    company_id: "cmp-bom-preco",
    title: "Operador de Caixa",
    description:
      "Registro de compras, recebimento em dinheiro, cartão e PIX, fechamento " +
      "de caixa e atendimento ao cliente.\n\n" +
      "Requisitos: ensino médio completo. Não exigimos experiência — " +
      "treinamento fornecido pela empresa.\n\n" +
      "Escala 6x1, com folga aos domingos alternados.",
    category: "Comércio e Vendas",
    city: "Sinop",
    neighborhood: "Jardim Paraíso",
    contract_type: "CLT",
    salary_min: 1500,
    salary_max: 1800,
    skills: ["Caixa", "Atendimento ao cliente"],
    status: "aberta",
    created_at: hoursAgo(8),
    company: companyRef("cmp-bom-preco"),
    applicant_count: 47,
  },
  {
    id: "job-motorista-carreta",
    company_id: "cmp-transportes-brasil",
    title: "Motorista de Carreta",
    description:
      "Transporte de grãos e insumos agrícolas nas rotas Sinop–Sorriso–Cuiabá " +
      "e eventualmente para portos do Norte.\n\n" +
      "Requisitos: CNH categoria E válida, curso MOPP em dia, mínimo de 2 anos " +
      "de experiência com carreta, sem restrições no prontuário.\n\n" +
      "Diária de viagem paga à parte do salário. Frota nova, rastreada.",
    category: "Logística e Transporte",
    city: "Sinop",
    neighborhood: "Setor Industrial",
    contract_type: "CLT",
    salary_min: 2800,
    salary_max: 3500,
    skills: ["CNH E", "Carreta"],
    status: "aberta",
    created_at: daysAgo(1),
    company: companyRef("cmp-transportes-brasil"),
    applicant_count: 9,
  },
  {
    id: "job-auxiliar-producao",
    company_id: "cmp-agro-norte",
    title: "Auxiliar de Produção",
    description:
      "Apoio na linha de beneficiamento de grãos: abastecimento de máquinas, " +
      "ensaque, paletização e limpeza do setor.\n\n" +
      "Requisitos: ensino fundamental completo, disponibilidade para turnos.\n\n" +
      "Adicional noturno para o turno da madrugada. Transporte fretado saindo " +
      "do Centro de Sinop.",
    category: "Indústria e Produção",
    city: "Sinop",
    neighborhood: "Setor Industrial",
    contract_type: "CLT",
    salary_min: 1650,
    salary_max: 1900,
    skills: ["Linha de produção", "Controle de qualidade"],
    status: "aberta",
    created_at: daysAgo(1),
    company: companyRef("cmp-agro-norte"),
    applicant_count: 8,
  },
  {
    id: "job-analista-financeiro",
    company_id: "cmp-agro-norte",
    title: "Analista Financeiro",
    description:
      "Conciliação bancária, fluxo de caixa, elaboração de relatórios " +
      "gerenciais e apoio ao fechamento mensal junto à contabilidade.\n\n" +
      "Requisitos: superior em Ciências Contábeis, Administração ou Economia; " +
      "Excel avançado; experiência prévia em rotina financeira.\n\n" +
      "Plano de saúde após 90 dias.",
    category: "Administrativo",
    city: "Sinop",
    neighborhood: "Centro",
    contract_type: "CLT",
    salary_min: 4000,
    salary_max: 5500,
    skills: ["Excel", "Conciliação bancária", "ERP"],
    status: "aberta",
    created_at: daysAgo(2),
    company: companyRef("cmp-agro-norte"),
    applicant_count: 12,
  },
  {
    id: "job-tecnico-enfermagem",
    company_id: "cmp-clinica-vida",
    title: "Técnico de Enfermagem",
    description:
      "Atendimento em clínica de pequeno porte: triagem, aferição de sinais " +
      "vitais, curativos, administração de medicamentos sob prescrição.\n\n" +
      "Requisitos: curso técnico concluído e COREN ativo.\n\n" +
      "Escala 12x36, diurna.",
    category: "Saúde",
    city: "Sinop",
    neighborhood: "Jardim Botânico",
    contract_type: "CLT",
    salary_min: 2400,
    salary_max: 2900,
    skills: ["COREN", "Atendimento ao paciente"],
    status: "aberta",
    created_at: daysAgo(3),
    company: companyRef("cmp-clinica-vida"),
    applicant_count: 6,
  },
  {
    id: "job-estagio-agronomia",
    company_id: "cmp-agro-norte",
    title: "Estágio em Agronomia",
    description:
      "Acompanhamento de campo junto ao time agronômico: monitoramento de " +
      "pragas, coleta de amostras de solo e registro de dados de lavoura.\n\n" +
      "Requisitos: cursando a partir do 5º semestre de Agronomia, CNH B.\n\n" +
      "Bolsa-auxílio mais vale-transporte. Possibilidade de efetivação.",
    category: "Agronegócio",
    city: "Sinop",
    neighborhood: "Setor Industrial",
    contract_type: "Estágio",
    salary_min: 1200,
    salary_max: null,
    skills: ["Análise de solo", "Excel"],
    status: "aberta",
    created_at: daysAgo(4),
    company: companyRef("cmp-agro-norte"),
    applicant_count: 22,
  },
  {
    id: "job-ajudante-pedreiro",
    company_id: "cmp-casa-construcao",
    title: "Ajudante de Obra",
    description:
      "Apoio a pedreiros em obras residenciais: preparo de massa, transporte " +
      "de material, organização e limpeza do canteiro.\n\n" +
      "Requisitos: disposição para trabalho físico. Experiência não é " +
      "obrigatória.\n\n" +
      "Contrato temporário de 6 meses, com possibilidade de efetivação.",
    category: "Construção Civil",
    city: "Sinop",
    neighborhood: "Jardim Primavera",
    contract_type: "Temporário",
    salary_min: 1600,
    salary_max: null,
    skills: ["Pedreiro", "Alvenaria"],
    status: "aberta",
    created_at: daysAgo(5),
    company: companyRef("cmp-casa-construcao"),
    applicant_count: 4,
  },
];

/* ============================================================
   Prestadores de serviço
   ============================================================ */

/**
 * Telefones não-discáveis de propósito: a parte de assinante começa em 0,
 * o que não existe no plano de numeração brasileiro.
 *
 * Em modo demonstração `resolveContact` já redirecionava o contato, então
 * estes números não eram usados. Mas o fallback silencioso de `data.ts`
 * servia este arquivo com o banco ligado — e aí o botão montava `wa.me`
 * com o número daqui, alcançando quem o tivesse de verdade em Sinop.
 * O fallback foi corrigido; o número não pode voltar a ser discável.
 */
export const MOCK_PROVIDERS: ProviderListing[] = [
  {
    profile_id: "prv-joao-silva",
    full_name: "João Silva",
    phone: "66000000001",
    city: "Sinop",
    neighborhood: "Jardim Botânico",
    avatar_url: `/avatares/prv-joao-silva.svg`,
    phone_verified: true,
    doc_verified: true,
    category_id: cat("eletricista").id,
    category: cat("eletricista"),
    description:
      "Trabalho com instalações elétricas residenciais e comerciais, " +
      "manutenção preventiva, troca de quadro de disjuntores e reparos em " +
      "geral. Atendo Sinop e região com orçamento sem compromisso.",
    starting_price: 150,
    years_experience: 7,
    service_area: ["Centro", "Jardim Botânico", "Jardim Paraíso", "Menezes"],
    photo_urls: [],
    avg_rating: 0, // derivado de MOCK_REVIEWS
    review_count: 0,
  },
  {
    profile_id: "prv-carlos-souza",
    full_name: "Carlos Souza",
    phone: "66000000002",
    city: "Sinop",
    neighborhood: "Centro",
    avatar_url: `/avatares/prv-carlos-souza.svg`,
    phone_verified: true,
    doc_verified: true,
    category_id: cat("encanador").id,
    category: cat("encanador"),
    description:
      "Encanador com atendimento de emergência. Conserto de vazamentos, " + "desentupimento, instalação de caixa d'água, aquecedor e louças " + "sanitárias. Atendo também aos finais de semana.",
    starting_price: 120,
    years_experience: 12,
    service_area: ["Centro", "Setor Comercial", "Jardim Itália"],
    photo_urls: [],
    avg_rating: 0, // derivado de MOCK_REVIEWS
    review_count: 0,
  },
  {
    profile_id: "prv-marcos-lima",
    full_name: "Marcos Lima",
    phone: "66000000003",
    city: "Sinop",
    neighborhood: "Jardim das Palmeiras",
    avatar_url: `/avatares/prv-marcos-lima.svg`,
    phone_verified: true,
    doc_verified: true,
    category_id: cat("pintor").id,
    category: cat("pintor"),
    description: "Pintura residencial e comercial, textura, grafiato e massa corrida. " + "Faço o serviço completo, da preparação da parede à limpeza final. " + "Orçamento por metro quadrado.",
    starting_price: 200,
    years_experience: 9,
    service_area: ["Jardim das Palmeiras", "Residencial Florença", "Centro"],
    photo_urls: [],
    avg_rating: 0, // derivado de MOCK_REVIEWS
    review_count: 0,
  },
  {
    profile_id: "prv-jose-moreira",
    full_name: "José Moreira",
    phone: "66000000004",
    city: "Sinop",
    neighborhood: "Jardim Primavera",
    avatar_url: `/avatares/prv-jose-moreira.svg`,
    phone_verified: true,
    doc_verified: false,
    category_id: cat("pedreiro").id,
    category: cat("pedreiro"),
    description: "Pedreiro para obras pequenas e médias: alvenaria, reboco, contrapiso, " + "assentamento de piso e azulejo, pequenas reformas. Trabalho com " + "ajudante próprio.",
    starting_price: 180,
    years_experience: 15,
    service_area: ["Jardim Primavera", "Boa Esperança", "Jacarandá"],
    photo_urls: [],
    avg_rating: 0, // derivado de MOCK_REVIEWS
    review_count: 0,
  },
  {
    profile_id: "prv-ana-paula",
    full_name: "Ana Paula Ribeiro",
    phone: "66000000005",
    city: "Sinop",
    neighborhood: "Jardim Celeste",
    avatar_url: `/avatares/prv-ana-paula.svg`,
    phone_verified: true,
    doc_verified: true,
    category_id: cat("diarista").id,
    category: cat("diarista"),
    description:
      "Diarista com referências. Faxina completa, limpeza pesada pós-obra e " + "organização de armários. Levo meu próprio material de limpeza se " + "preferir. Disponível de segunda a sábado.",
    starting_price: 140,
    years_experience: 6,
    service_area: ["Jardim Celeste", "Centro", "Aquarela Brasil"],
    photo_urls: [],
    avg_rating: 0, // derivado de MOCK_REVIEWS
    review_count: 0,
  },
  {
    profile_id: "prv-rosa-mendes",
    full_name: "Rosa Mendes",
    phone: "66000000006",
    city: "Sinop",
    neighborhood: "Menezes",
    avatar_url: `/avatares/prv-rosa-mendes.svg`,
    phone_verified: true,
    doc_verified: true,
    category_id: cat("cuidador").id,
    category: cat("cuidador"),
    description:
      "Cuidadora de idosos com curso técnico e experiência hospitalar. " +
      "Acompanhamento em casa ou no hospital, administração de medicação por " +
      "horário e apoio na higiene e alimentação. Diária ou plantão.",
    starting_price: 180,
    years_experience: 8,
    service_area: ["Menezes", "Centro", "Jardim Botânico"],
    photo_urls: [],
    avg_rating: 0, // derivado de MOCK_REVIEWS
    review_count: 0,
  },
  {
    profile_id: "prv-pedro-alves",
    full_name: "Pedro Alves",
    phone: "66000000007",
    city: "Sinop",
    neighborhood: "Boa Esperança",
    avatar_url: `/avatares/prv-pedro-alves.svg`,
    phone_verified: true,
    doc_verified: false,
    category_id: cat("jardineiro").id,
    category: cat("jardineiro"),
    description: "Manutenção de jardim, corte de grama, poda de árvores e cerca viva, " + "plantio e adubação. Atendo casas e condomínios, com contrato mensal ou " + "serviço avulso.",
    starting_price: 100,
    years_experience: 5,
    service_area: ["Boa Esperança", "Residencial Florença", "Jardim Itália"],
    photo_urls: [],
    avg_rating: 0, // derivado de MOCK_REVIEWS
    review_count: 0,
  },
  {
    profile_id: "prv-luciana-costa",
    full_name: "Luciana Costa",
    phone: "66000000008",
    city: "Sinop",
    neighborhood: "Aquarela Brasil",
    avatar_url: `/avatares/prv-luciana-costa.svg`,
    phone_verified: true,
    doc_verified: true,
    category_id: cat("diarista").id,
    category: cat("diarista"),
    description: "Faxina residencial e limpeza de escritório. Trabalho por diária ou " + "duas vezes por semana com valor fechado. Passo roupa mediante combinado.",
    starting_price: 130,
    years_experience: 4,
    service_area: ["Aquarela Brasil", "Jardim Paraíso", "Setor Comercial"],
    photo_urls: [],
    avg_rating: 0, // derivado de MOCK_REVIEWS
    review_count: 0,
  },
  {
    profile_id: "prv-antonio-ferreira",
    full_name: "Antônio Ferreira",
    phone: "66000000009",
    city: "Sinop",
    neighborhood: "Setor Comercial",
    avatar_url: `/avatares/prv-antonio-ferreira.svg`,
    phone_verified: true,
    doc_verified: true,
    category_id: cat("eletricista").id,
    category: cat("eletricista"),
    description: "Eletricista especializado em ar-condicionado split: instalação, " + "limpeza, recarga de gás e manutenção. Também faço rede elétrica para " + "climatização de lojas e escritórios.",
    starting_price: 220,
    years_experience: 11,
    service_area: ["Setor Comercial", "Centro", "Setor Industrial"],
    photo_urls: [],
    avg_rating: 0, // derivado de MOCK_REVIEWS
    review_count: 0,
  },
];

/* ============================================================
   Avaliações
   ============================================================ */

/**
 * Fonte única da verdade das notas: `avg_rating` e `review_count` dos
 * prestadores são calculados a partir desta lista, logo abaixo. Em produção
 * o mesmo papel é feito pelo trigger `refresh_provider_rating` no Postgres.
 */
type ReviewSeed = [provider: string, reviewer: string, rating: number, daysBack: number, comment: string];

const REVIEW_SEEDS: ReviewSeed[] = [
  // João Silva — eletricista
  ["prv-joao-silva", "Ana Paula", 5, 3, "Excelente profissional! Pontual, educado e serviço de qualidade. Resolveu um problema no quadro que dois outros eletricistas não acharam."],
  ["prv-joao-silva", "Roberto M.", 5, 11, "Fez toda a parte elétrica da minha reforma. Preço justo e deixou tudo organizado."],
  ["prv-joao-silva", "Camila S.", 4, 24, "Bom serviço. Atrasou um pouco no dia, mas avisou antes."],
  ["prv-joao-silva", "Edson Vargas", 5, 31, "Troquei o padrão de energia com ele. Explicou tudo e cuidou da parte burocrática."],
  ["prv-joao-silva", "Márcia B.", 5, 40, "Atendeu rápido, resolveu o curto e ainda revisou o resto da casa."],
  ["prv-joao-silva", "Tiago Nunes", 5, 52, "Serviço limpo e bem feito. Já indiquei pra dois vizinhos."],
  ["prv-joao-silva", "Helena C.", 4, 66, "Bom profissional. Só achei o valor do deslocamento um pouco alto."],

  // Marcos Lima — pintor
  ["prv-marcos-lima", "Fernanda L.", 5, 6, "Pintou a casa inteira em 4 dias. Acabamento impecável e protegeu todos os móveis."],
  ["prv-marcos-lima", "Diego R.", 5, 19, "Recomendo. Orçamento fechado, sem surpresa no final."],
  ["prv-marcos-lima", "Cláudia F.", 5, 28, "Fez grafiato na sala e ficou perfeito. Caprichoso demais."],
  ["prv-marcos-lima", "Rogério P.", 5, 45, "Pontual todos os dias e deixou tudo limpo no fim."],
  ["prv-marcos-lima", "Bianca S.", 4, 61, "Trabalho muito bom. Levou dois dias a mais do que o combinado."],
  ["prv-marcos-lima", "Nilson A.", 5, 78, "Pintei minha loja com ele. Fez à noite pra não atrapalhar o movimento."],

  // Carlos Souza — encanador
  ["prv-carlos-souza", "Marta O.", 5, 8, "Chamei num domingo por causa de um vazamento e ele veio no mesmo dia. Salvou minha casa."],
  ["prv-carlos-souza", "Jonas T.", 5, 17, "Desentupiu a pia e explicou como evitar. Cobrou o combinado."],
  ["prv-carlos-souza", "Luana R.", 4, 33, "Resolveu bem. Demorou um pouco pra chegar, mas avisou."],
  ["prv-carlos-souza", "Ivan M.", 5, 49, "Instalou a caixa d'água nova rapidinho. Profissional experiente."],
  ["prv-carlos-souza", "Rita G.", 5, 70, "Muito atencioso, resolveu um problema antigo de pressão da água."],

  // Ana Paula Ribeiro — diarista
  ["prv-ana-paula", "Juliana T.", 5, 2, "Melhor diarista que já contratei em Sinop. Caprichosa e de total confiança."],
  ["prv-ana-paula", "Marcelo D.", 5, 9, "Faz limpeza pesada muito bem. Deixou o apartamento novo depois da obra."],
  ["prv-ana-paula", "Sônia W.", 5, 22, "Pontual, honesta e organizada. Já é fixa aqui em casa."],
  ["prv-ana-paula", "Patrícia N.", 5, 38, "Confio a chave da casa a ela. Isso diz tudo."],
  ["prv-ana-paula", "Alex F.", 5, 55, "Trabalho impecável e preço justo."],

  // Rosa Mendes — cuidadora
  ["prv-rosa-mendes", "Paulo H.", 5, 14, "Cuidou da minha mãe por três meses com muito carinho e responsabilidade."],
  ["prv-rosa-mendes", "Denise A.", 5, 26, "Sabe lidar com idoso acamado e com a medicação certinha no horário."],
  ["prv-rosa-mendes", "Wagner L.", 5, 43, "Acompanhou meu pai no hospital. Muito atenciosa com a família também."],
  ["prv-rosa-mendes", "Cristina M.", 4, 59, "Ótima cuidadora. Só teve dificuldade em um dia de plantão extra."],

  // Antônio Ferreira — eletricista / ar-condicionado
  ["prv-antonio-ferreira", "Loja Girassol", 5, 5, "Instalou 4 splits na loja num sábado pra não parar o movimento. Profissional de confiança."],
  ["prv-antonio-ferreira", "Renata V.", 5, 13, "Limpeza e recarga de gás bem feitas. O ar voltou a gelar como novo."],
  ["prv-antonio-ferreira", "Douglas S.", 5, 27, "Fez toda a rede elétrica pro ar do escritório. Serviço caprichado."],
  ["prv-antonio-ferreira", "Isabela K.", 4, 41, "Bom serviço, mas remarcou uma vez."],
  ["prv-antonio-ferreira", "Fábio C.", 5, 63, "Chegou no horário, cobrou o orçado e explicou a manutenção."],

  // José Moreira — pedreiro
  ["prv-jose-moreira", "Sandra V.", 4, 21, "Serviço bem feito. O prazo estendeu alguns dias por causa da chuva."],
  ["prv-jose-moreira", "Otávio B.", 5, 34, "Assentou o piso da área toda. Nivelamento perfeito."],
  ["prv-jose-moreira", "Elaine D.", 5, 50, "Trabalha com o próprio ajudante e rende bem. Recomendo."],
  ["prv-jose-moreira", "Gustavo R.", 4, 72, "Bom pedreiro. Combine bem o material antes pra não faltar."],

  // Luciana Costa — diarista
  ["prv-luciana-costa", "Vanessa P.", 5, 7, "Limpa o escritório duas vezes por semana. Nunca deu problema."],
  ["prv-luciana-costa", "Henrique O.", 5, 20, "Muito organizada e discreta. Ótimo custo-benefício."],
  ["prv-luciana-costa", "Aline S.", 4, 47, "Bom trabalho. Passa roupa muito bem."],

  // Pedro Alves — jardineiro
  ["prv-pedro-alves", "Condomínio Ipê", 5, 12, "Faz a manutenção do jardim do condomínio todo mês. Sempre em dia."],
  ["prv-pedro-alves", "Silvana T.", 4, 29, "Podou as árvores do quintal e limpou tudo depois."],
  ["prv-pedro-alves", "Ricardo M.", 4, 57, "Serviço bom e preço honesto."],
];

export const MOCK_REVIEWS: Review[] = REVIEW_SEEDS.map(([provider_id, reviewer_name, rating, back, comment], i) => ({
  id: `rev-${i + 1}`,
  provider_id,
  reviewer_name,
  rating,
  comment,
  created_at: daysAgo(back),
}));

/**
 * Recalcula nota e contagem de cada prestador a partir das avaliações acima,
 * para que perfil, cards e barras nunca discordem entre si.
 */
for (const provider of MOCK_PROVIDERS) {
  const own = MOCK_REVIEWS.filter((r) => r.provider_id === provider.profile_id);
  provider.review_count = own.length;
  provider.avg_rating = own.length ? Math.round((own.reduce((sum, r) => sum + r.rating, 0) / own.length) * 10) / 10 : 0;
}

/* ============================================================
   Candidaturas (painel Minha Empresa)
   ============================================================ */

export const MOCK_APPLICATIONS: ApplicationWithCandidate[] = [
  {
    id: "app-1",
    job_id: "job-operador-maquinas",
    candidate_id: "cnd-1",
    status: "enviada",
    created_at: hoursAgo(1),
    job_title: "Operador de Máquinas Agrícolas",
    candidate: {
      full_name: "Everton Rodrigues",
      avatar_url: "/avatares/cnd-everton-rodrigues.svg",
      neighborhood: "Jardim Primavera",
      desired_area: "Agronegócio",
      city: "Sinop",
      email: "everton@teste.lupa",
      phone: "6600000001",
      availability: "Imediata",
      summary: "Cinco anos operando colheitadeira e plantadeira em fazenda de soja.",
      experiences: [],
      education: "Ensino médio completo",
      skills: ["Colheitadeira", "Plantadeira", "Manutenção básica"],
      resume_url: null,
    },
  },
  {
    id: "app-2",
    job_id: "job-operador-maquinas",
    candidate_id: "cnd-2",
    status: "visualizada",
    created_at: hoursAgo(5),
    job_title: "Operador de Máquinas Agrícolas",
    candidate: {
      full_name: "Wesley Barbosa",
      avatar_url: "/avatares/cnd-wesley-barbosa.svg",
      neighborhood: "Boa Esperança",
      desired_area: "Agronegócio",
      city: "Sinop",
      email: "wesley@teste.lupa",
      phone: "6600000002",
      availability: "A combinar",
      summary: "Trabalho com trator há três anos, incluindo safra e entressafra.",
      experiences: [],
      education: "Ensino médio completo",
      skills: ["Trator", "Pulverizador"],
      resume_url: null,
    },
  },
  {
    id: "app-3",
    job_id: "job-operador-maquinas",
    candidate_id: "cnd-3",
    status: "entrevista",
    created_at: daysAgo(1),
    job_title: "Operador de Máquinas Agrícolas",
    candidate: {
      full_name: "Adriano Klein",
      avatar_url: "/avatares/cnd-adriano-klein.svg",
      neighborhood: "Setor Industrial",
      desired_area: "Agronegócio",
      city: "Sinop",
      email: "simone@teste.lupa",
      phone: "6600000003",
      availability: "Imediata",
      summary: "Experiência em linha de produção e controle de qualidade.",
      experiences: [],
      education: "Ensino médio completo",
      skills: ["Linha de produção", "Controle de qualidade"],
      resume_url: null,
    },
  },
  {
    id: "app-4",
    job_id: "job-auxiliar-producao",
    candidate_id: "cnd-4",
    status: "enviada",
    created_at: hoursAgo(9),
    job_title: "Auxiliar de Produção",
    candidate: {
      full_name: "Simone Batista",
      avatar_url: "/avatares/cnd-simone-batista.svg",
      neighborhood: "Menezes",
      desired_area: "Indústria e Produção",
      city: "Sinop",
      email: "adriano@teste.lupa",
      phone: "6600000004",
      availability: "A partir do mês que vem",
      summary: "Operador de máquinas com CNH categoria D.",
      experiences: [],
      education: "Ensino médio completo",
      skills: ["CNH D", "Empilhadeira"],
      resume_url: null,
    },
  },
  {
    id: "app-5",
    job_id: "job-analista-financeiro",
    candidate_id: "cnd-5",
    status: "visualizada",
    created_at: daysAgo(2),
    job_title: "Analista Financeiro",
    candidate: {
      full_name: "Priscila Nogueira",
      avatar_url: "/avatares/cnd-priscila-nogueira.svg",
      neighborhood: "Centro",
      desired_area: "Administrativo",
      city: "Sinop",
      email: "priscila@teste.lupa",
      phone: "6600000005",
      availability: "Imediata",
      summary: "Rotina financeira: contas a pagar, conciliação e fechamento.",
      experiences: [],
      education: "Superior em Ciências Contábeis",
      skills: ["Excel", "Conciliação bancária", "ERP"],
      resume_url: null,
    },
  },
  {
    id: "app-6",
    job_id: "job-estagio-agronomia",
    candidate_id: "cnd-6",
    status: "enviada",
    created_at: daysAgo(3),
    job_title: "Estágio em Agronomia",
    candidate: {
      full_name: "Lucas Trindade",
      avatar_url: "/avatares/cnd-lucas-trindade.svg",
      neighborhood: "Jardim Botânico",
      desired_area: "Agronegócio",
      city: "Sinop",
      email: "lucas@teste.lupa",
      phone: "6600000006",
      availability: "Meio período",
      summary: "Cursando Agronomia, buscando primeiro estágio na área.",
      experiences: [],
      education: "Cursando Agronomia — 6º semestre",
      skills: ["Análise de solo", "Excel"],
      resume_url: null,
    },
  },
];

/* ============================================================
   Fila de verificação (painel admin)
   ============================================================ */

export interface VerificationRequest {
  id: string;
  profile_id: string;
  full_name: string;
  role: "prestador_servico" | "empresa" | "candidato_clt";
  category: string | null;
  city: string;
  phone: string;
  submitted_at: string;
  status: "em_analise" | "aprovado" | "reprovado";
}

export const MOCK_VERIFICATIONS: VerificationRequest[] = [
  {
    id: "ver-1",
    profile_id: "prv-jose-moreira",
    full_name: "José Moreira",
    role: "prestador_servico",
    category: "Pedreiro",
    city: "Sinop",
    phone: "66000000004",
    submitted_at: hoursAgo(3),
    status: "em_analise",
  },
  {
    id: "ver-2",
    profile_id: "prv-pedro-alves",
    full_name: "Pedro Alves",
    role: "prestador_servico",
    category: "Jardineiro",
    city: "Sinop",
    phone: "66000000007",
    submitted_at: hoursAgo(20),
    status: "em_analise",
  },
  {
    id: "ver-3",
    profile_id: "cmp-bom-preco",
    full_name: "Supermercado Bom Preço",
    role: "empresa",
    category: null,
    city: "Sinop",
    phone: "6600000022",
    submitted_at: daysAgo(2),
    status: "em_analise",
  },
];
