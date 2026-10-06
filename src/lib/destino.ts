/**
 * Valida o `?destino=` do login, para não virar trampolim de phishing (#345).
 *
 * O valor vem da URL, e a URL vem de fora. Sem esta checagem,
 * `/entrar?destino=https://outro-site` levaria a pessoa, depois de entrar de
 * verdade na Lupa, para um site que a imita pedindo a senha de novo.
 *
 * **Resolve contra a própria origem e exige que continue nela.** A versão
 * antiga olhava prefixos à mão — barrava `//evil.com` mas não `/\evil.com`,
 * porque o navegador trata `\` como `/` em http(s) e `/\evil.com` resolve para
 * `https://evil.com`. Enumerar formas de escapar sempre deixa a próxima passar;
 * perguntar "isto continua sendo nós?" fecha todas de uma vez.
 *
 * `origem` é injetada (no cliente, `window.location.origin`) para a função ser
 * pura e testável sem navegador. Devolve só o caminho relativo — o que
 * `router.replace` precisa para navegar dentro do app —, ou `null` para
 * qualquer coisa que escape da origem ou não seja uma URL.
 */
export function destinoSeguro(
  bruto: string | undefined | null,
  origem: string,
): string | null {
  if (!bruto) return null;
  try {
    const url = new URL(bruto, origem);
    if (url.origin !== origem) return null;
    return url.pathname + url.search + url.hash;
  } catch {
    return null;
  }
}
