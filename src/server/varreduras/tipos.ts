/**
 * O registro das varreduras agendadas (#566).
 *
 * Até aqui, a única prova de que uma varredura tinha rodado era o log da
 * Vercel, que no plano grátis guarda 30 minutos. Se o `CRON_SECRET`
 * quebrasse — como o segredo do webhook quebrou em setembro —, a varredura
 * pararia sem nada ficar vermelho. Agora cada uma grava a última execução,
 * e o painel do admin mostra.
 *
 * **Uma linha por varredura, sobrescrita.** Não é histórico: histórico de
 * 90 dias a Vercel já guarda, na aba Schedules (#565). O que faltava era o
 * sinal no lugar que o Luiz abre todo dia.
 */

/** As varreduras que existem, e o nome que o painel mostra. */
export const VARREDURAS = {
  "reconciliar-pagamentos": "Conferência de pagamentos",
  "avisar-vagas-vencendo": "Aviso de vaga vencendo",
} as const;

export type NomeDaVarredura = keyof typeof VARREDURAS;

/** O que cada número do resumo quer dizer, para o painel escrever por extenso. */
export const ROTULOS_DO_RESUMO: Record<string, [string, string]> = {
  vistas: ["cobrança conferida", "cobranças conferidas"],
  reconciliadas: ["acertada", "acertadas"],
  vagasVencendo: ["vaga vencendo", "vagas vencendo"],
  empresasAvisadas: ["empresa avisada", "empresas avisadas"],
};

export type ResumoDaVarredura = Record<string, number | string>;

export interface ExecucaoDeVarredura {
  nome: NomeDaVarredura;
  /** Quando rodou pela última vez, com sucesso ou não. */
  rodouEm: string;
  ok: boolean;
  /** Os números da última execução, ou `{ erro }` quando falhou. */
  resumo: ResumoDaVarredura;
  /** A última vez que deu certo — é por ela que se sabe se está atrasada. */
  ultimaOkEm: string | null;
}

export interface SituacaoDaVarredura {
  nome: NomeDaVarredura;
  titulo: string;
  ultima: ExecucaoDeVarredura | null;
  atrasada: boolean;
}

/**
 * Um dia e duas horas. A varredura roda uma vez por dia, dentro de quinze
 * minutos do horário (#565); vinte e seis horas sem sucesso quer dizer que
 * a de hoje não aconteceu.
 */
export const HORAS_ATE_ATRASAR = 26;

/**
 * A situação de cada varredura conhecida, na ordem de `VARREDURAS`.
 *
 * **Atrasada é "sem sucesso há mais de 26 horas"**, e não "a última
 * falhou": é o que cobre os três jeitos de parar — segredo ausente (503,
 * que grava a falha), segredo divergente (401, que não grava nada, porque
 * de fora não se distingue de quem bate na porta sem ser a Vercel) e o
 * agendamento desligado (nada chega).
 *
 * Sem registro nenhum não é atrasada: é a varredura que ainda não rodou
 * depois do deploy que começou a registrar.
 */
export function situacaoDasVarreduras(
  execucoes: ReadonlyArray<ExecucaoDeVarredura>,
  agora: Date,
): SituacaoDaVarredura[] {
  const limite = agora.getTime() - HORAS_ATE_ATRASAR * 60 * 60 * 1000;
  return (Object.keys(VARREDURAS) as NomeDaVarredura[]).map((nome) => {
    const ultima = execucoes.find((e) => e.nome === nome) ?? null;
    const atrasada =
      ultima !== null &&
      (ultima.ultimaOkEm === null ||
        new Date(ultima.ultimaOkEm).getTime() < limite);
    return { nome, titulo: VARREDURAS[nome], ultima, atrasada };
  });
}

export interface RepositorioVarreduras {
  /**
   * Grava a execução por cima da anterior. A falha não apaga quando foi o
   * último sucesso.
   */
  registrar(
    nome: NomeDaVarredura,
    execucao: { ok: boolean; resumo: ResumoDaVarredura; em: string },
  ): Promise<void>;
  todas(): Promise<ExecucaoDeVarredura[]>;
}
