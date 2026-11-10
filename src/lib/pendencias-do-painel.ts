import type { ApplicationStatus } from "./types";

/*
 * "Precisa da sua atenção" (#610): o que o painel da empresa lista para ser
 * resolvido, separado da tela para ser testado sem desenhar nada.
 *
 * Tudo sai do que o painel já lê — candidaturas, vagas e entrevistas — mais
 * a última movimentação de cada candidatura, que vem do histórico (#608).
 */

/** Quantos dias sem mexer fazem um processo "parado". */
export const DIAS_PARA_PARAR = 7;

const UM_DIA_MS = 24 * 60 * 60 * 1000;

/**
 * As etapas em que a bola está com a empresa. Aprovado espera a contratação,
 * mas não é pendência de triagem; contratado e reprovado estão encerrados.
 */
const EM_ANDAMENTO: readonly ApplicationStatus[] = [
  "enviada",
  "visualizada",
  "contatada",
  "entrevista",
];

export interface CandidaturaDoPainel {
  id: string;
  job_id: string;
  status: ApplicationStatus;
  created_at: string;
}

export interface VagaDoPainel {
  id: string;
  title: string;
  status: string;
  expires_at: string;
}

export interface ProcessoParado {
  vagaId: string;
  titulo: string;
  /** Quantas pessoas esperam nesta vaga, nas etapas em andamento. */
  esperando: number;
  /** Dias inteiros desde a última vez que alguém mexeu em qualquer uma. */
  dias: number;
}

/**
 * As vagas no ar cujas candidaturas em andamento ninguém move há
 * `DIAS_PARA_PARAR` dias.
 *
 * **O relógio é o da vaga, não o de cada candidatura**: mexer em uma pessoa
 * prova que a empresa está cuidando daquele processo, e listar as outras
 * doze como paradas seria cobrar por um trabalho em andamento. A data de
 * cada candidatura é a última movimentação dela ou, sem nenhuma, o dia em
 * que chegou — o histórico só existe desde a #608.
 *
 * Vaga encerrada ou vencida não entra: ali não há processo para andar.
 */
export function processosParados(
  vagas: ReadonlyArray<VagaDoPainel>,
  candidaturas: ReadonlyArray<CandidaturaDoPainel>,
  ultimaMovimentacao: ReadonlyMap<string, string>,
  agora: Date = new Date(),
): ProcessoParado[] {
  const hoje = agora.getTime();
  const parados: ProcessoParado[] = [];

  for (const vaga of vagas) {
    if (vaga.status !== "aberta" || Date.parse(vaga.expires_at) <= hoje) {
      continue;
    }
    const andando = candidaturas.filter(
      (c) => c.job_id === vaga.id && EM_ANDAMENTO.includes(c.status),
    );
    if (andando.length === 0) continue;

    const maisRecente = Math.max(
      ...andando.map((c) =>
        Date.parse(ultimaMovimentacao.get(c.id) ?? c.created_at),
      ),
    );
    const dias = Math.floor((hoje - maisRecente) / UM_DIA_MS);
    if (dias >= DIAS_PARA_PARAR) {
      parados.push({
        vagaId: vaga.id,
        titulo: vaga.title,
        esperando: andando.length,
        dias,
      });
    }
  }

  // O mais parado primeiro: é o que mais perde candidato.
  return parados.sort((a, b) => b.dias - a.dias);
}

/** As vagas no ar: abertas e dentro do prazo. */
export function contarVagasAtivas(
  vagas: ReadonlyArray<VagaDoPainel>,
  agora: Date = new Date(),
): number {
  return vagas.filter(
    (v) => v.status === "aberta" && Date.parse(v.expires_at) > agora.getTime(),
  ).length;
}

/** Em quantos dias vence, arredondado para cima e nunca menos que um. */
export function diasAteVencer(
  expiraEm: string,
  agora: Date = new Date(),
): number {
  return Math.max(
    1,
    Math.ceil((Date.parse(expiraEm) - agora.getTime()) / UM_DIA_MS),
  );
}
