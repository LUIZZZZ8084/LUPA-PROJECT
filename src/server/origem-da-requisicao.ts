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
  if (real) return real;

  const vercel = cabecalhos
    .get("x-vercel-forwarded-for")
    ?.split(",")[0]
    ?.trim();
  if (vercel) return vercel;

  const cadeia = cabecalhos.get("x-forwarded-for")?.split(",");
  const ultimo = cadeia?.[cadeia.length - 1]?.trim();
  return ultimo || "desconhecida";
}
