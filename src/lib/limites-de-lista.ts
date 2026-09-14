/**
 * Quantas linhas cada listagem traz do banco (#203).
 *
 * Nenhuma consulta de lista tinha teto. Com 8 vagas isso é irrelevante;
 * com 5.000, **toda abertura de `/vagas` puxa a tabela inteira** — e o
 * custo cresce por volume de dado, não por número de gente. É o teto que
 * chega primeiro de verdade, e chega em silêncio: nada quebra, só fica
 * mais caro e mais lento até parar.
 *
 * ## Por que teto e não paginação de verdade, por enquanto
 *
 * `/vagas` e `/servicos` buscam tudo e **reordenam por proximidade em
 * JavaScript** (`src/lib/proximidade.ts`). Paginar no banco do jeito
 * ingênuo quebraria isso: a página 1 viria pelas mais recentes e a
 * proximidade valeria só dentro daquelas — alguém de Sinop deixaria de ver
 * a vaga de Sinop porque ela é a 30ª mais recente. Seria recriar a
 * armadilha da #76, onde um padrão invisível escondia vaga e a empresa
 * concluía que não tinha publicado.
 *
 * O teto preserva o sinal que o banco já ordena — mais recentes para vaga,
 * melhor avaliadas para prestador — e a proximidade reordena dentro desse
 * recorte. **A tela diz que é um recorte**, pela mesma razão que já diz
 * "mais perto de você primeiro".
 *
 * Paginação de verdade exige a escada de proximidade em SQL, e isso exige
 * o mapa de regiões do IBGE no banco — hoje é arquivo versionado. Fica
 * registrado como o passo seguinte, não como coisa esquecida.
 *
 * ## Os números
 *
 * Todos com folga de uma ordem de grandeza sobre o volume de hoje. Teto
 * que a operação normal encosta é teto que vira reclamação; teto que
 * ninguém alcança em anos não protege de nada.
 */

/**
 * Busca pública de vagas e de prestadores.
 *
 * Cem é mais do que alguém rola numa sessão, e mais do que a ordenação por
 * proximidade consegue diferenciar de forma útil — passando disso, o que
 * decide não é mais "perto", é "existe".
 */
export const TETO_BUSCA = 100;

/**
 * Candidatos que pediram para ser encontrados.
 *
 * Mesmo raciocínio da busca, e a mesma tela de filtros por habilidade e
 * área — quem procura perfil refina, não rola até o fim.
 */
export const TETO_CANDIDATOS = 100;

/**
 * Currículos recebidos, no painel de quem contrata.
 *
 * Mais alto que a busca de propósito: aqui o recorte esconderia **a
 * candidatura de alguém que se inscreveu de verdade**, e isso é pior que
 * esconder um resultado de busca. Duzentos cobre qualquer vaga real desta
 * cidade com folga larga.
 */
export const TETO_CANDIDATURAS = 200;

/**
 * Avaliações de um prestador.
 *
 * Bounded por prestador, não pela plataforma inteira — mas prestador
 * popular acumula, e a tela mostra as mais recentes de qualquer forma.
 */
export const TETO_AVALIACOES = 50;

/**
 * Fila de verificação do admin, e outras listas internas.
 *
 * Não é tela de público: quem olha é quem administra, e a fila que passar
 * disso é sinal de que ninguém está olhando.
 */
export const TETO_ADMIN = 200;

/**
 * Listas do próprio dono — as vagas de uma empresa, as publicações de um
 * prestador, os aparelhos inscritos em aviso.
 *
 * Cresce por pessoa e devagar. O teto existe para que "por pessoa" não
 * vire "sem teto" no dia em que alguém automatizar a própria conta.
 */
export const TETO_DO_DONO = 200;

/**
 * Quem recebe aviso de vaga nova.
 *
 * Este não é tela: é o alcance de um envio em segundo plano, e cresce com
 * a base inteira. O teto aqui não é para proteger a tela — é para que uma
 * publicação não vire um trabalho de tamanho imprevisível dentro de
 * `after()`, onde ninguém está olhando o relógio.
 */
export const TETO_ENVIO_DE_AVISO = 500;

/**
 * A série de 30 dias de métricas de quem contrata.
 *
 * Não cresce com a plataforma, cresce com a conta: é uma linha por vaga
 * por dia. Com `TETO_DO_DONO` vagas e 31 dias dá pouco menos de 6.200,
 * então o teto é redondo logo acima disso — sobra para a conta cheia e
 * corta o caso em que alguém automatizou a própria.
 */
export const TETO_SERIE_DE_METRICAS = 6500;

/**
 * Uma listagem já cortada, e a informação de que houve corte.
 *
 * O booleano é a parte que não dá para deixar de fora. Cortar em silêncio
 * é a armadilha da #76 de novo — lá um padrão invisível escondia vaga e a
 * empresa concluía que não tinha publicado. A tela precisa poder dizer
 * "tem mais", e para isso precisa saber.
 */
export interface Recorte<T> {
  itens: T[];
  /** Havia mais do que o teto: a tela avisa e oferece filtrar. */
  houveCorte: boolean;
}

/**
 * Corta no teto e diz se cortou.
 *
 * Quem consulta o banco pede `teto + 1` de propósito: a linha extra não é
 * mostrada, ela só responde "havia mais". Contar com `count` seria uma
 * segunda consulta para saber o que uma linha a mais já conta.
 */
export function recortar<T>(linhas: T[], teto: number): Recorte<T> {
  return { itens: linhas.slice(0, teto), houveCorte: linhas.length > teto };
}
