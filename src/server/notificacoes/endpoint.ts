/**
 * Para onde a Lupa aceita mandar um aviso de push (#356).
 *
 * O endereço de inscrição vem do navegador de quem se inscreveu, e depois o
 * servidor faz uma requisição HTTPS para ele a cada vaga publicada. Validar
 * só que é uma URL deixava a pessoa escolher o destino dessa requisição.
 * Endereço de push de verdade sempre mora num destes serviços, então a
 * regra é a lista, e não uma tentativa de reconhecer endereços ruins.
 *
 * - FCM: Chrome, Edge, Brave, Opera e Samsung Internet.
 * - Mozilla: Firefox.
 * - Apple: Safari.
 * - WNS: o serviço de push do Windows.
 *
 * Um navegador com serviço fora da lista não consegue ligar o aviso, e a
 * tela diz isso. É o preço de a lista ser fechada, e é pequeno: os quatro
 * acima cobrem os navegadores que alguém usa.
 */
const SERVICOS_DE_PUSH: readonly RegExp[] = [
  /^fcm\.googleapis\.com$/,
  /^updates\.push\.services\.mozilla\.com$/,
  /^([a-z0-9-]+\.)+push\.apple\.com$/,
  /^([a-z0-9-]+\.)+notify\.windows\.com$/,
];

export function endpointDePushPermitido(endpoint: string): boolean {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }

  if (url.protocol !== "https:") return false;
  // Usuário, senha e porta não existem em endereço de push de verdade.
  if (url.username || url.password || url.port) return false;

  return SERVICOS_DE_PUSH.some((servico) => servico.test(url.hostname));
}
