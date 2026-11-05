import type { DadosCurriculo } from "./gerar";

/**
 * Um currículo preenchido, para ver o modelo sem um perfil de verdade (#531).
 *
 * A área de testes do admin usa este para a prévia: a conta do admin não
 * tem perfil de candidato preenchido, e o PDF dela sai com o nome e o
 * contato — o que não mostra o modelo. A pessoa é inventada, e o telefone e
 * o e-mail não existem.
 */
export const CURRICULO_DE_EXEMPLO: DadosCurriculo = {
  nomeCompleto: "Mariana Alves de Souza",
  email: "mariana.exemplo@lupa.invalid",
  telefone: "66900000000",
  cidade: "Sinop - MT",
  areaDesejada: "Logística e Transporte",
  resumo:
    "Profissional com 8 anos de experiência em logística e expedição, com " +
    "passagem por armazém de grãos e centro de distribuição. Acostumada a " +
    "conferência de carga, controle de estoque e operação de empilhadeira, " +
    "com foco em organização, cumprimento de prazo e segurança no trabalho.",
  experiencias: [
    {
      role: "Líder de expedição",
      company: "Armazém Norte Grãos",
      period: "mar/2021 – atual",
      description:
        "Coordeno uma equipe de 6 pessoas na expedição de soja e milho. " +
        "Organizo a fila de carregamento, confiro notas fiscais e reduzi o " +
        "tempo médio de carregamento de 50 para 35 minutos.",
    },
    {
      role: "Auxiliar de logística",
      company: "Distribuidora Teles Pires",
      period: "jan/2018 – fev/2021",
      description:
        "Separação e conferência de pedidos, inventário mensal e operação " +
        "de empilhadeira no centro de distribuição.",
    },
    {
      role: "Estoquista",
      company: "Supermercado Bom Preço",
      period: "jun/2016 – dez/2017",
    },
  ],
  formacao:
    "Técnico em Logística — SENAI Sinop (2017)\n" +
    "Ensino médio completo — E.E. Nilza de Oliveira Pipino (2015)",
  habilidades: [
    "Operação de empilhadeira (NR-11)",
    "Controle de estoque",
    "Conferência de nota fiscal",
    "Pacote Office",
    "CNH categoria B",
    "Liderança de equipe",
  ],
  disponibilidade: "Imediata, para turno diurno ou noturno.",
};
