import type { Papel } from "@/server/auth/rbac";

/**
 * Quem contrata pela Lupa tem duas portas, e o app fala a língua de cada
 * uma (#189).
 *
 * Empresa e prestador contratam **do mesmo jeito** desde a #129 — as
 * quatro capacidades de vaga estão nos dois papéis, e a carteira é por
 * `usuario_id`, não por empresa. O que difere é só quem a pessoa é: o
 * produtor rural que contrata um ajudante não se reconhece em "Minha
 * Empresa", e a área inteira estava escrita para quem tem CNPJ.
 *
 * **Duas rotas, uma implementação.** Os corpos das telas moram nesta
 * pasta e recebem a área por parâmetro; `/empresa/**` e `/contratar/**`
 * são arquivos finos que só dizem qual das duas renderizar. Duplicar as
 * ~990 linhas do painel daria o gêmeo que diverge na primeira vez que
 * alguém mexe num lado só — foi o que aconteceu com
 * `perfis_empresa.plano`, que apareceu em três telas e precisou de três
 * correções (#172, #179, #182).
 *
 * A pasta começa com `_` porque o App Router tira do roteamento tudo que
 * é prefixado assim: isto aqui é código compartilhado, não uma terceira
 * área.
 */
export interface AreaDeContratacao {
  /** Prefixo de toda rota da área — nenhum link é escrito à mão. */
  base: "/empresa" | "/contratar";
  /** O nome da área, para título de página e para o link de voltar. */
  nome: string;
}

export const AREA_EMPRESA: AreaDeContratacao = {
  base: "/empresa",
  nome: "Minha Empresa",
};

export const AREA_PRESTADOR: AreaDeContratacao = {
  base: "/contratar",
  nome: "Contratar",
};

/**
 * As duas bases, para quem precisa alcançar as duas de uma vez.
 *
 * É o caso do `revalidatePath` nas actions: publicar uma vaga muda o
 * painel, e a action não sabe — nem precisa saber — de qual das duas
 * portas veio o clique. Revalidar um caminho que a pessoa não está vendo
 * não custa nada; **não** revalidar o caminho certo deixa a tela mentindo
 * sobre o que acabou de acontecer.
 */
export const BASES_DE_CONTRATACAO = ["/empresa", "/contratar"] as const;

/**
 * A área de quem entrou, ou `null` para quem não contrata.
 *
 * O candidato cai no `null` e recebe a explicação da #122 — que a área é
 * de quem contrata —, nunca um 404. O admin também: ele enxerga tudo pelo
 * `/admin/painel`, e uma área de contratação própria é justamente o que
 * ele não tem.
 */
export function areaDoPapel(papel: Papel): AreaDeContratacao | null {
  if (papel === "empresa") return AREA_EMPRESA;
  if (papel === "prestador_servico") return AREA_PRESTADOR;
  return null;
}
