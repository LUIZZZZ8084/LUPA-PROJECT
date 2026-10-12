import "server-only";

import { headers } from "next/headers";

/**
 * De onde veio a requisição, para a chave do teto por ação sem sessão (#346).
 *
 * Existia copiado em quatro lugares — `action.ts`, o cadastro, "esqueci minha
 * senha" e o reenvio de confirmação —, cada um lendo o **primeiro** elemento
 * de `x-forwarded-for`. Essa é a posição que o cliente controla: numa cadeia
 * com um proxy externo na frente (um CDN/WAF como o Cloudflare na frente da
 * Vercel), o proxy acrescenta o IP real **depois** do que o cliente mandou, e
 * `split(",")[0]` devolve o valor forjado. O teto deixaria de limitar quem
 * cria conta em massa ou dispara e-mail de recuperação em nome da Lupa.
 *
 * Em Vercel pura isso não acontece — ela sobrescreve `x-forwarded-for` e não
 * repassa IP externo —, mas depender disso é o caveat "fora da Vercel precisa
 * reavaliar" que o código antigo carregava. Aqui a ordem é sempre segura:
 *
 * 1. `x-real-ip` — o IP do cliente que a borda da Vercel calcula, um valor só
 *    e que o cliente não escolhe.
 * 2. `x-vercel-forwarded-for` — a versão da Vercel do `x-forwarded-for`, que um
 *    proxy em cima não sobrescreve; o primeiro item aqui é confiável porque foi
 *    a Vercel que montou a cadeia.
 * 3. O elemento **à direita** de `x-forwarded-for` — o que o proxy confiável
 *    mais próximo acrescentou. Fora da Vercel é o melhor palpite, e nunca é o
 *    primeiro, que é o que o cliente forja.
 *
 * Sem nenhum deles, todo mundo cai em "desconhecida" e divide o mesmo teto —
 * deliberado: limite compartilhado atrapalha menos do que limite nenhum, e o
 * caso só acontece sem proxy nenhum na frente.
 */
export async function origemDaRequisicao(): Promise<string> {
  const cabecalhos = await headers();

  const real = cabecalhos.get("x-real-ip")?.trim();
  if (real) return agruparOrigem(real);

  const vercel = cabecalhos
    .get("x-vercel-forwarded-for")
    ?.split(",")[0]
    ?.trim();
  if (vercel) return agruparOrigem(vercel);

  const cadeia = cabecalhos.get("x-forwarded-for")?.split(",");
  const ultimo = cadeia?.[cadeia.length - 1]?.trim();
  return ultimo ? agruparOrigem(ultimo) : "desconhecida";
}

const GRUPO_IPV6 = /^[0-9a-f]{1,4}$/;

/**
 * IPv6 vira a rede /64; o resto passa como veio (#415).
 *
 * Quem tem IPv6 recebe da operadora uma rede /64 inteira — 2^64
 * endereços —, e escolhe qualquer um deles. Chaveado pelo endereço, cada
 * troca era um teto novo: o limite de cadastro, de recuperação e de ação
 * sem sessão deixava de limitar exatamente quem mais insiste. A rede é o
 * que a operadora dá a uma casa ou a um aparelho, então é ela a unidade.
 *
 * IPv4 mapeado em IPv6 (`::ffff:1.2.3.4`) volta a ser o IPv4, para os dois
 * jeitos de escrever o mesmo endereço caírem na mesma chave. Qualquer coisa
 * que não se reconheça passa sem mexer: uma chave estranha limita uma
 * pessoa só, e um erro aqui derrubaria o cadastro de todo mundo.
 */
export function agruparOrigem(ip: string): string {
  const valor = ip.trim().toLowerCase().split("%")[0];

  const mapeado = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(valor);
  if (mapeado) return mapeado[1];
  if (!valor.includes(":")) return valor;

  const metades = valor.split("::");
  if (metades.length > 2) return valor;

  const grupos = (texto: string) => (texto ? texto.split(":") : []);
  const esquerda = grupos(metades[0]);
  const direita = metades.length === 2 ? grupos(metades[1]) : [];

  // Um IPv4 no fim ocupa dois grupos.
  const ultimo = [...esquerda, ...direita].at(-1) ?? "";
  const ocupados =
    esquerda.length + direita.length + (ultimo.includes(".") ? 1 : 0);
  const zeros = metades.length === 2 ? 8 - ocupados : 0;
  if (zeros < 0) return valor;

  const prefixo = [...esquerda, ...Array(zeros).fill("0"), ...direita].slice(
    0,
    4,
  );
  if (prefixo.length < 4 || !prefixo.every((g) => GRUPO_IPV6.test(g))) {
    return valor;
  }
  return `${prefixo.map((g) => g.replace(/^0+(?=.)/, "")).join(":")}::/64`;
}
