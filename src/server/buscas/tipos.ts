/**
 * Buscas que não acharam nada.
 *
 * Existe para responder uma pergunta que hoje é palpite: vale ampliar a
 * tabela de sinônimos em `src/lib/skills.ts`, ou o vocabulário é variado
 * demais e a busca precisa virar semântica?
 *
 * Sem esse registro, a escolha seria feita por intuição — e busca vetorial
 * custa dinheiro por consulta, latência numa tela que abre em 3G, e uma
 * dependência externa no caminho crítico. Decisão desse tamanho merece um
 * mês de dado antes.
 *
 * **Não se guarda quem buscou.** Nem id, nem sessão, nem endereço.
 * Histórico de busca de quem procura emprego é a mesma classe de
 * informação que o currículo: numa cidade do tamanho de Sinop, saber que
 * uma pessoa pesquisou "vaga de motorista" três vezes esta semana diz que
 * ela quer sair do emprego atual.
 */

/** Onde a busca aconteceu. */
export type OndeBuscou = "vagas" | "servicos";

export interface TermoSemResultado {
  termo: string;
  total: number;
}

export interface RepositorioBuscas {
  /** Soma uma ocorrência do termo, no dia de hoje. */
  registrar(termo: string, onde: OndeBuscou): Promise<void>;

  /** Os mais buscados sem resultado, do mais frequente para o menos. */
  maisBuscados(dias: number, limite: number): Promise<TermoSemResultado[]>;
}

/**
 * O termo, do jeito que ele vira estatística.
 *
 * Minúsculas e sem acento porque o que interessa é agrupar: "Eletricista",
 * "eletricista" e "ELETRICISTA" são a mesma pergunta, e só viram sinal
 * quando somam.
 *
 * Devolve `null` para o que não vale contar — vazio, curto demais ou longo
 * demais. Termo de uma letra é engano de digitação; termo de duzentos
 * caracteres é alguém colando um texto, e nos dois casos a linha só
 * atrapalharia quem for ler a lista depois.
 */
export function termoParaEstatistica(bruto: string): string | null {
  const limpo = bruto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

  if (limpo.length < 2 || limpo.length > 80) return null;
  return limpo;
}
