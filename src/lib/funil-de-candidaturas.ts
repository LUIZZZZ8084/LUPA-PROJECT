import { APPLICATION_LABELS } from "./constants";
import type { ApplicationStatus } from "./types";

/*
 * As contas da área de contratação como mini CRM (#511), separadas da tela
 * para serem testadas sem desenhar nada. Tudo sai do que o painel já lê: as
 * candidaturas e as vagas da empresa da sessão.
 */

/** Os estágios, na ordem do funil: a mesma de `APPLICATION_LABELS`. */
export const ESTAGIOS = Object.keys(APPLICATION_LABELS) as ApplicationStatus[];

export function ehEstagio(valor: unknown): valor is ApplicationStatus {
  return typeof valor === "string" && (ESTAGIOS as string[]).includes(valor);
}

export type ContagemPorEstagio = Record<ApplicationStatus, number>;

export function contarPorEstagio(
  candidaturas: ReadonlyArray<{ status: ApplicationStatus }>,
): ContagemPorEstagio {
  const contagem = Object.fromEntries(
    ESTAGIOS.map((e) => [e, 0]),
  ) as ContagemPorEstagio;
  for (const c of candidaturas) contagem[c.status] += 1;
  return contagem;
}

/**
 * Quantas candidaturas chegaram **pelo menos** a cada estágio do caminho.
 *
 * Quem foi selecionado passou pela entrevista e pela triagem, mesmo que a
 * empresa tenha pulado de "Nova" direto para "Selecionado": o funil conta o
 * alcance, não o estágio de agora. Reprovado não entra em passo nenhum além
 * do primeiro, porque não se sabe até onde a pessoa foi antes de sair.
 */
export function alcancePorEtapa(contagem: ContagemPorEstagio): {
  recebidas: number;
  olhadas: number;
  entrevistas: number;
  selecionados: number;
} {
  const total = ESTAGIOS.reduce((s, e) => s + contagem[e], 0);
  return {
    recebidas: total,
    olhadas: total - contagem.enviada,
    entrevistas: contagem.entrevista + contagem.aprovada,
    selecionados: contagem.aprovada,
  };
}

const UM_DIA_MS = 24 * 60 * 60 * 1000;

/**
 * As vagas no ar que saem da busca nos próximos `dias` — o que a empresa
 * reativa, ou deixa vencer de propósito. A vencida já não entra: ela tem
 * selo próprio na aba de vagas.
 */
export function vagasVencendo<T extends { status: string; expires_at: string }>(
  vagas: ReadonlyArray<T>,
  dias = 3,
  agora: Date = new Date(),
): T[] {
  // Um relógio só, o `agora` recebido: `vagaExpirada` lê o de verdade, e
  // misturar os dois fazia o teste quebrar conforme a data (#520).
  const inicio = agora.getTime();
  const limite = inicio + dias * UM_DIA_MS;
  return vagas.filter((v) => {
    const vence = Date.parse(v.expires_at);
    return v.status === "aberta" && vence > inicio && vence <= limite;
  });
}
