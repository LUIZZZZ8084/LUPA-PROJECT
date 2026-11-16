import type { ApplicationStatus } from "./types";

/*
 * Os filtros da lista de candidatos (#620), separados da tela para serem
 * testados sem desenhar nada.
 */

export const PERIODOS = { "7": 7, "30": 30 } as const;
export type Periodo = keyof typeof PERIODOS;

export function ehPeriodo(valor: unknown): valor is Periodo {
  return typeof valor === "string" && valor in PERIODOS;
}

/** Minúsculas e sem acento: "joao" acha "João". */
export function semAcento(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

const UM_DIA_MS = 24 * 60 * 60 * 1000;

export function filtrarCandidaturas<
  T extends {
    job_id: string;
    status: ApplicationStatus;
    created_at: string;
    candidate: { full_name: string };
  },
>(
  candidaturas: readonly T[],
  filtros: {
    nome?: string;
    vaga?: string;
    estagio?: ApplicationStatus;
    periodo?: Periodo;
  },
  agora: Date = new Date(),
): T[] {
  const procurado = semAcento(filtros.nome?.trim() ?? "");
  const desde = filtros.periodo
    ? agora.getTime() - PERIODOS[filtros.periodo] * UM_DIA_MS
    : null;
  return candidaturas.filter(
    (c) =>
      (!filtros.vaga || c.job_id === filtros.vaga) &&
      (!filtros.estagio || c.status === filtros.estagio) &&
      (desde === null || Date.parse(c.created_at) >= desde) &&
      (!procurado || semAcento(c.candidate.full_name).includes(procurado)),
  );
}
