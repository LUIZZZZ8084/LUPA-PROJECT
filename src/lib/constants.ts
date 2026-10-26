import type { ContractType, ServiceCategory, WorkMode } from "./types";

/*
 * Não existe mais cidade inicial nem estado do app (#301).
 *
 * O app começou em Sinop e passou a aceitar Mato Grosso inteiro; hoje aceita
 * qualquer município do Brasil, e nenhum vem escolhido por padrão — uma
 * cidade pré-selecionada é um palpite que a pessoa de outro lugar precisa
 * desfazer, e quem não percebe acaba cadastrado na cidade errada. A lista e
 * o formato da cidade ("Sinop - MT") moram em `src/lib/cidades/`.
 */

/**
 * O menor tamanho de senha que o app aceita (#290).
 *
 * Mora aqui, e não só no schema do servidor, porque a dica da tela e a regra
 * precisam dizer o mesmo número. Ficaram um mês dizendo números diferentes:
 * o servidor exigia 10 e as duas telas de senha prometiam 8. Quem seguia a
 * dica levava erro, e o formulário ainda apagava tudo (#291).
 *
 * Seis é decisão do Luiz em 25/09/2026: o público digita no celular, e dez
 * era demais. O NIST recomenda no mínimo 8. O que segura a senha curta aqui é
 * o resto da proteção: limite de tentativas de login por e-mail, Argon2id no
 * hash e a mesma resposta de login exista a conta ou não.
 */
export const SENHA_MINIMA = 6;

/**
 * As sete primeiras são o V0 — mão de obra manual, o público mais
 * numeroso do piloto. As dez de 8 a 17 entraram em 03/09/2026, a pedido
 * do Luiz: o prestador não é só quem trabalha com as mãos, e faltava
 * espaço para programador, designer e a área de saúde autônoma.
 *
 * A lista é expansível sem migração de *schema* — a tabela já existe —,
 * mas cada linha nova em produção precisa de uma migração de *dado*
 * idempotente (`supabase/aplica-*.sql`), porque `categorias_servico` tem
 * FK em `perfis_prestador.categoria_id`. O `id` aqui precisa bater com o
 * `id` gravado lá; nunca reordene ou reaproveite um id já usado.
 */
export const SERVICE_CATEGORIES: ServiceCategory[] = [
  { id: 1, slug: "eletricista", name: "Eletricista" },
  { id: 2, slug: "diarista", name: "Diarista" },
  { id: 3, slug: "pintor", name: "Pintor" },
  { id: 4, slug: "encanador", name: "Encanador" },
  { id: 5, slug: "pedreiro", name: "Pedreiro" },
  { id: 6, slug: "jardineiro", name: "Jardineiro" },
  { id: 7, slug: "cuidador", name: "Cuidador(a)" },
  { id: 8, slug: "programador", name: "Programador(a)" },
  { id: 9, slug: "designer", name: "Designer Gráfico(a)" },
  { id: 10, slug: "tecnico-enfermagem", name: "Técnico(a) de Enfermagem" },
  { id: 11, slug: "farmaceutico", name: "Farmacêutico(a)" },
  { id: 12, slug: "fisioterapeuta", name: "Fisioterapeuta" },
  { id: 13, slug: "cabeleireiro", name: "Cabeleireiro(a)" },
  { id: 14, slug: "manicure", name: "Manicure" },
  { id: 15, slug: "fotografo", name: "Fotógrafo(a)" },
  { id: 16, slug: "personal-trainer", name: "Personal Trainer" },
  { id: 17, slug: "mecanico", name: "Mecânico(a)" },
  /*
   * As trinta e três de baixo entraram em 13/10/2026 (#457). Com o app
   * aberto ao Brasil inteiro, quem é marceneiro, soldador, babá ou
   * tratorista não achava a própria profissão. Os ids batem com os de
   * `categorias_servico`, e um teste compara as duas listas.
   */
  { id: 18, slug: "marceneiro", name: "Marceneiro(a)" },
  { id: 19, slug: "serralheiro", name: "Serralheiro(a)" },
  { id: 20, slug: "soldador", name: "Soldador(a)" },
  { id: 21, slug: "gesseiro", name: "Gesseiro(a)" },
  { id: 22, slug: "vidraceiro", name: "Vidraceiro(a)" },
  { id: 23, slug: "azulejista", name: "Azulejista" },
  {
    id: 24,
    slug: "tecnico-ar-condicionado",
    name: "Técnico(a) de Ar-condicionado",
  },
  { id: 25, slug: "tecnico-informatica", name: "Técnico(a) de Informática" },
  { id: 26, slug: "tecnico-celular", name: "Técnico(a) de Celular" },
  { id: 27, slug: "chaveiro", name: "Chaveiro(a)" },
  { id: 28, slug: "montador-moveis", name: "Montador(a) de Móveis" },
  {
    id: 29,
    slug: "instalador-energia-solar",
    name: "Instalador(a) de Energia Solar",
  },
  {
    id: 30,
    slug: "instalador-cameras",
    name: "Instalador(a) de Câmeras e Alarmes",
  },
  { id: 31, slug: "dedetizador", name: "Dedetizador(a)" },
  { id: 32, slug: "piscineiro", name: "Piscineiro(a)" },
  { id: 33, slug: "motoboy", name: "Motoboy / Entregador(a)" },
  { id: 34, slug: "motorista-particular", name: "Motorista Particular" },
  { id: 35, slug: "baba", name: "Babá" },
  { id: 36, slug: "passadeira", name: "Passadeira" },
  { id: 37, slug: "costureira", name: "Costureira(o)" },
  { id: 38, slug: "cozinheiro", name: "Cozinheiro(a)" },
  { id: 39, slug: "confeiteiro", name: "Confeiteiro(a) / Padeiro(a)" },
  { id: 40, slug: "churrasqueiro", name: "Churrasqueiro(a)" },
  { id: 41, slug: "garcom", name: "Garçom / Garçonete" },
  { id: 42, slug: "barbeiro", name: "Barbeiro(a)" },
  { id: 43, slug: "maquiador", name: "Maquiador(a)" },
  { id: 44, slug: "massoterapeuta", name: "Massoterapeuta" },
  { id: 45, slug: "esteticista", name: "Esteticista" },
  { id: 46, slug: "contador", name: "Contador(a)" },
  { id: 47, slug: "professor-particular", name: "Professor(a) Particular" },
  { id: 48, slug: "veterinario", name: "Veterinário(a)" },
  { id: 49, slug: "tosador", name: "Banho e Tosa" },
  { id: 50, slug: "tratorista", name: "Tratorista / Operador(a) de Máquinas" },
];

/**
 * Áreas das vagas CLT — setores amplos, não profissões específicas
 * (o campo livre da vaga já diz o cargo). É `text` solto no banco, sem
 * FK: ao contrário de `SERVICE_CATEGORIES`, adicionar item aqui é só
 * mudar a constante.
 *
 * As dez últimas entraram em 03/09/2026 junto com a expansão de
 * `SERVICE_CATEGORIES` — Sinop tem economia além de agro e comércio, e
 * a lista original deixava de fora setores comuns no interior de MT.
 */
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
  "Beleza e Estética",
  "Segurança",
  "Finanças e Contabilidade",
  "Jurídico",
  "Marketing e Comunicação",
  "Turismo e Hotelaria",
  "Meio Ambiente",
  "Mineração",
  "Telecomunicações",
  "Frigorífico e Agroindústria",
  // As quinze de baixo entraram em 13/10/2026 (#457). Sem renomear nem
  // reordenar o que já existe: a área gravada num perfil ou numa vaga é o
  // próprio texto, e mudar um nome esconderia o que já foi publicado.
  "Atendimento ao Cliente",
  "Recursos Humanos",
  "Engenharia e Arquitetura",
  "Limpeza e Conservação",
  "Manutenção e Reparos",
  "Automotivo e Mecânica",
  "Veterinária e Pecuária",
  "Energia e Utilidades",
  "Madeira e Móveis",
  "Esportes e Lazer",
  "Artes, Design e Criação",
  "Imobiliário e Seguros",
  "Compras e Suprimentos",
  "Assistência Social e Cuidados",
  "Serviço Público e Terceiro Setor",
] as const;

export const CONTRACT_TYPES: ContractType[] = [
  "CLT",
  "Estágio",
  "Temporário",
  "Freelance",
  "Jovem Aprendiz",
];

/** O valor gravado é o do enum; o rótulo é o que a tela mostra (#300). */
export const WORK_MODE_LABELS: Record<WorkMode, string> = {
  presencial: "Presencial",
  home_office: "Home office",
  hibrido: "Híbrido",
};

export const WORK_MODES = Object.keys(WORK_MODE_LABELS) as WorkMode[];

/**
 * O selo da vaga para pessoa com deficiência (#456). Num lugar só: o card,
 * a página, a revisão e o filtro dizem a mesma coisa.
 */
export const ROTULO_PCD = "Vaga para PCD";

/**
 * Valor de `?tipo=` que liga o filtro de PCD (#463). O filtro mora dentro
 * da lista de Tipo, mas PCD não é tipo de contrato: a página traduz este
 * valor e não o repassa à consulta como contrato.
 */
export const PCD_NO_TIPO = "pcd";

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

/**
 * Estágios do processo, do ponto de vista de quem contrata.
 *
 * `enviada` se chama "Nova" na tela: toda candidatura da lista foi
 * enviada — é a definição de estar ali —, então "Enviada" descrevia o
 * óbvio, e do ponto de vista errado. O que a empresa precisa saber é o
 * que ainda não olhou.
 *
 * O valor no banco continua `enviada`: mudar o enum custaria migração e
 * apagaria o histórico, sem ganhar nada.
 */
export const APPLICATION_LABELS = {
  enviada: "Nova",
  visualizada: "Em triagem",
  entrevista: "Entrevista",
  aprovada: "Selecionado",
  rejeitada: "Reprovado",
} as const;

/**
 * Os mesmos estágios, ditos para quem se candidatou.
 *
 * Só `enviada` muda de nome, e a diferença é a pergunta de cada lado.
 * A empresa olha a lista e pergunta "o que ainda não olhei?" — para ela,
 * "Nova" responde. O candidato abre "Minhas candidaturas" e pergunta
 * "alguém já olhou o meu?" — e "Nova" não responde nada, porque a
 * candidatura dele nasceu nova e ele sabe disso.
 *
 * "Não visualizado" responde, e é verificável: o estágio sai de `enviada`
 * sozinho quando alguém da empresa abre a ficha (`marcarComoVisualizada`,
 * em `src/server/candidaturas/ficha.ts`). Não depende de a empresa
 * lembrar de marcar nada — e por isso a palavra pode ser categórica.
 *
 * Os outros quatro são iguais nos dois lados de propósito: nome diferente
 * para o mesmo estado, sem uma pergunta diferente por trás, seria só duas
 * pessoas falando de coisas distintas na mesma conversa.
 */
export const APPLICATION_LABELS_CANDIDATO = {
  ...APPLICATION_LABELS,
  enviada: "Não visualizado",
} as const;

/** Cor do selo de estágio, no painel da empresa e em "Minhas candidaturas". */
export const APPLICATION_TONE = {
  enviada: "servicos",
  visualizada: "neutral",
  entrevista: "warn",
  aprovada: "vagas",
  rejeitada: "danger",
} as const;
