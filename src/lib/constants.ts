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
 * Bairros conhecidos, por cidade.
 *
 * Só entra cidade cuja lista alguém conferiu. O resto usa texto livre —
 * ver `bairroLivre()` abaixo.
 *
 * A lista existe porque é ela que mantém o filtro de bairro utilizável:
 * digitado à mão, "Jd. Botânico", "Jardim Botanico" e "JARDIM BOTÂNICO"
 * viram três bairros diferentes e o filtro deixa de agrupar. O preço de
 * exigir lista para todo mundo seria manter os bairros de mais de 5.500
 * municípios, o que não existe pronto em lugar nenhum e envelheceria
 * sozinho. A chave é a cidade no formato gravado ("Sinop - MT").
 */
export const BAIRROS_POR_CIDADE: Record<string, readonly string[]> = {
  "Sinop - MT": [
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
  ],
};

/**
 * Os bairros que a cidade oferece numa lista. Vazio significa texto livre —
 * é assim que a tela decide entre `select` e `input`.
 */
export function bairrosDe(
  cidade: string | null | undefined,
): readonly string[] {
  if (!cidade) return [];
  return BAIRROS_POR_CIDADE[cidade] ?? [];
}

/**
 * Quantos bairros um prestador pode marcar como atendidos.
 *
 * Era 14 — o número de bairros de Sinop — e por isso quebrava em qualquer
 * outra cidade. Vinte é folga suficiente para o prestador dizer onde
 * atende sem que a lista vire "a cidade inteira", que não informa nada.
 */
export const MAX_BAIRROS_ATENDIDOS = 20;

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
