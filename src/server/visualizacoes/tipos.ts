/**
 * Visualizações de vaga e as séries do painel da empresa.
 *
 * O painel mostrava só total, e o total de visualizações era dado falso:
 * `getCompanyStats` devolvia um número fixo do `mock-data`, mesmo com o
 * banco ligado. A empresa via um número que nunca tinha sido medido.
 *
 * Duas implementações, como o resto do servidor: o que os testes exercitam
 * é o mesmo caminho que roda em produção, e a demonstração segue sem banco.
 */

/** Um ponto da série: um dia e o que aconteceu nele. */
export interface PontoDaSerie {
  /** `YYYY-MM-DD`, para casar com o que o Postgres devolve em `date`. */
  dia: string;
  visualizacoes: number;
  candidaturas: number;
}

export interface RepositorioVisualizacoes {
  /**
   * Soma uma visualização à vaga, no dia de hoje.
   *
   * Não recebe quem viu, de propósito: deduplicar por pessoa exigiria
   * guardar qual candidato olhou qual vaga — histórico de quem está
   * procurando trabalho, a mesma informação que mantém o currículo fora de
   * qualquer view pública.
   */
  registrar(vagaId: string): Promise<void>;

  /**
   * Série diária das vagas de uma empresa, do dia mais antigo ao mais
   * recente, **com os dias vazios preenchidos**.
   *
   * Dia sem movimento precisa aparecer como zero. Série que pula os vazios
   * mente sobre a constância: três candidaturas em três dias seguidos
   * viram o mesmo desenho de três candidaturas em três meses.
   */
  serieDaEmpresa(empresaId: string, dias: number): Promise<PontoDaSerie[]>;
}

/** Datas em `YYYY-MM-DD`, do dia mais antigo até hoje. */
export function diasAte(hoje: Date, quantidade: number): string[] {
  const saida: string[] = [];
  for (let i = quantidade - 1; i >= 0; i--) {
    const d = new Date(hoje);
    d.setUTCDate(d.getUTCDate() - i);
    saida.push(d.toISOString().slice(0, 10));
  }
  return saida;
}

/**
 * Monta a série contínua a partir de contagens esparsas.
 *
 * Compartilhada pelas duas implementações: o preenchimento dos dias vazios
 * é a parte que mais fácil se faz diferente em cada uma, e aí o gráfico
 * muda de forma conforme o modo — o tipo de diferença que só aparece na
 * demonstração para um cliente.
 */
export function montarSerie(
  dias: string[],
  visualizacoes: Map<string, number>,
  candidaturas: Map<string, number>,
): PontoDaSerie[] {
  return dias.map((dia) => ({
    dia,
    visualizacoes: visualizacoes.get(dia) ?? 0,
    candidaturas: candidaturas.get(dia) ?? 0,
  }));
}
