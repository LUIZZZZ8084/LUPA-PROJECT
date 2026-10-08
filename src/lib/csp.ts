/**
 * A Content-Security-Policy, montada com o nonce da requisição (#223).
 *
 * É a última linha: se alguma entrada escapar do escape em qualquer lugar,
 * é ela que impede o script injetado de rodar ou de mandar o que roubou
 * para fora.
 *
 * ## Por que ela mudou de lugar
 *
 * Até aqui a política era uma constante no `next.config.ts`, com
 * `'unsafe-inline'` em `script-src` — e com isso ela **não impedia** a
 * coisa que existe para impedir: um `<script>` injetado rodava, e um
 * `<img onerror=...>` também. O que sobrava de proteção era o `'self'`
 * barrando script de terceiro por `src`, e o `connect-src` barrando a
 * exfiltração. Útil, e é a segunda linha; a primeira estava aberta.
 *
 * O motivo escrito era verdadeiro: o Next injeta o script de hidratação
 * inline no App Router. O que faltava era o nonce — que o Next aplica
 * sozinho aos próprios scripts quando o middleware o anuncia no cabeçalho
 * da requisição. Por isso a política passou a ser montada por requisição,
 * no `proxy.ts`: constante não tem nonce.
 *
 * ## `'unsafe-inline'` continua na lista, e é de propósito
 *
 * Navegador que entende nonce **ignora `'unsafe-inline'`** quando há um
 * nonce na política — é assim que a especificação funciona, e é o padrão
 * recomendado de compatibilidade. Então a proteção vale onde importa, e
 * navegador antigo demais para nonce degrada para o comportamento de
 * ontem em vez de abrir uma tela em branco.
 *
 * Essa escolha é sobre este público em particular: aparelho velho, WebView
 * antiga, dado móvel contado. Tirar a linha por pureza faria o app não
 * abrir para quem já tem menos opção — e um app que não abre protege menos
 * do que um app que abre com a proteção de antes.
 *
 * ## O resto
 *
 * `img-src` aceita `https:` porque avatar e logo vêm do Storage do
 * Supabase, cujo domínio muda por projeto; `data:` é para o SVG inline dos
 * ícones. `frame-ancestors 'none'` repete o X-Frame-Options para navegador
 * que já ignora o cabeçalho antigo.
 *
 * `worker-src 'self' blob:` existe por causa da gravação de sessão do
 * Sentry (#281), que comprime o que grava num worker criado a partir de uma
 * URL `blob:`. Sem a diretiva, o navegador cai em `script-src`, recusa o
 * worker e deixa um erro de console em **toda** página. A gravação não
 * quebrava, só saía sem compressão. `blob:` fica só aqui, e não em
 * `script-src`: criar um worker exige já estar executando script, então a
 * permissão não abre porta nenhuma que o nonce feche.
 *
 * `'unsafe-eval'` só em desenvolvimento: o React em modo de
 * desenvolvimento usa `eval` para reconstruir a pilha de chamada de erro
 * vinda do servidor, e sem ele todo `npm run dev` abre com um erro
 * vermelho no console que não tem nada a ver com o código — ruído que
 * treina a equipe a ignorar o console.
 */

/**
 * Monta a política para uma requisição.
 *
 * `nonce` é gerado por requisição em `src/proxy.ts`. Reaproveitar um nonce
 * entre requisições anularia o ponto: quem conseguisse lê-lo uma vez
 * assinaria script em toda visita seguinte.
 */
export function politicaDeSeguranca(
  nonce: string,
  ambiente = process.env.NODE_ENV,
): string {
  const evalNoDev = ambiente === "development" ? " 'unsafe-eval'" : "";

  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'unsafe-inline'${evalNoDev}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co https://*.ingest.sentry.io",
    "worker-src 'self' blob:",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "object-src 'none'",
  ].join("; ");
}

/**
 * Um nonce novo, com entropia de sobra e sem caracteres que precisem de
 * escape dentro do cabeçalho.
 *
 * `crypto.randomUUID` existe no runtime de borda, que é onde o proxy roda
 * — `node:crypto` não.
 */
export function novoNonce(): string {
  return crypto.randomUUID().replaceAll("-", "");
}
