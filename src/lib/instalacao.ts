/**
 * O convite para instalar a Lupa no celular (#475).
 *
 * Cada aparelho deixa instalar de um jeito, e o convite precisa dizer a
 * verdade sobre o que acontece no toque:
 *
 * - **Android** (Chrome, Edge, Samsung Internet): o navegador entrega ao
 *   site um pedido de instalação (`beforeinstallprompt`), e um toque abre a
 *   janela de instalar. Ele só chega quando o navegador decide — depois de
 *   a pessoa interagir com a página, e nunca se o app já está instalado.
 *   Antes disso, o toque dá a dica do menu.
 * - **iPhone**: a Apple não dá a site nenhum um jeito de instalar. O toque
 *   dá a dica do Compartilhar.
 * - **Dentro do Instagram ou do Facebook**: nenhum dos dois deixa instalar
 *   por dentro, em nenhum sistema. A dica é abrir no navegador.
 * - **Computador**: não há convite. O pedido foi para quem está no celular.
 *
 * As regras são funções puras, com o aparelho e o estado chegando por
 * parâmetro, para serem testadas sem navegador.
 */

export type Aparelho = "android" | "iphone" | "app-embutido" | "computador";

/**
 * O que o botão faz quando tocado — ou `nenhuma`, quando ele não aparece.
 */
export type Oferta =
  | "nenhuma"
  | "instalar-direto"
  | "dica-iphone"
  | "dica-android"
  | "abrir-no-navegador";

/**
 * O aviso de que o pedido de instalação chegou, ou de que o app foi
 * instalado. O script do `<head>` o dispara; o botão o ouve.
 */
export const EVENTO_INSTALAVEL = "lupa:instalavel";

/**
 * Os navegadores embutidos que não instalam nada: Instagram, Facebook e
 * Messenger (`FBAN`, `FBAV`, `FB_IAB`), LINE e o TikTok. O link chega à
 * Lupa por eles mais do que por qualquer outro lugar fora do WhatsApp.
 */
const EMBUTIDOS =
  /Instagram|FBAN|FBAV|FB_IAB|FBIOS|Line\/|musical_ly|BytedanceWebview/i;

/**
 * Que aparelho está olhando, a partir do que o navegador diz de si.
 *
 * O iPad desde o iPadOS 13 se apresenta como Mac; o que o separa de um Mac
 * de verdade é a tela de toque. No iPhone, um navegador sem `Safari/` no
 * nome é uma tela embutida em outro app — o Safari, o Chrome e o Firefox do
 * iPhone dizem `Safari/`. No Android, `; wv)` é a WebView, que é sempre de
 * outro app.
 */
export function aparelhoDoNavegador(
  agenteDoUsuario: string,
  pontosDeToque: number,
): Aparelho {
  const ua = agenteDoUsuario;
  const ios =
    /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && pontosDeToque > 1);
  const android = /Android/.test(ua);

  if (!ios && !android) return "computador";
  if (EMBUTIDOS.test(ua)) return "app-embutido";
  if (ios) return /Safari\//.test(ua) ? "iphone" : "app-embutido";
  return /; wv\)/.test(ua) ? "app-embutido" : "android";
}

/**
 * O que oferecer, dado o aparelho e o estado.
 *
 * `instalado` cobre os dois jeitos de já ter o app: estar aberto nele (a
 * tela inicial abre sem barra de navegador) e o Android dizer que ele já
 * está no aparelho. `temPedido` é o pedido de instalação que o navegador
 * entregou e ninguém usou ainda.
 *
 * `dispensado` é o "Agora não" desta visita, e só dela: na próxima vez que
 * a pessoa abre a Lupa, o convite volta. Decisão do Luiz em 20/10/2026 —
 * esconder por 30 dias era tempo demais para quem só não queria agora.
 */
export function ofertaDeInstalacao(estado: {
  aparelho: Aparelho;
  instalado: boolean;
  dispensado: boolean;
  temPedido: boolean;
}): Oferta {
  if (estado.aparelho === "computador" || estado.instalado) return "nenhuma";
  if (estado.dispensado) return "nenhuma";
  switch (estado.aparelho) {
    case "iphone":
      return "dica-iphone";
    case "app-embutido":
      return "abrir-no-navegador";
    case "android":
      return estado.temPedido ? "instalar-direto" : "dica-android";
  }
}

/**
 * O pedido que o Chrome entrega, com o pouco que a Lupa usa dele. Não está
 * na biblioteca de tipos do DOM porque não é padrão: só os navegadores do
 * Chromium o têm.
 */
export interface PedidoDeInstalacao extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

declare global {
  interface Window {
    __lupaPedidoDeInstalacao?: PedidoDeInstalacao | null;
    __lupaInstalado?: boolean;
  }
}

/**
 * Roda no `<head>`, antes de qualquer componente existir.
 *
 * O Chrome entrega o pedido uma vez por carregamento, e pode entregá-lo
 * antes de o React terminar de montar a página: um ouvinte posto pelo
 * componente chegaria tarde e o botão nunca instalaria direto. O script o
 * guarda em `window`, e o componente o lê de lá.
 *
 * `preventDefault` troca a barrinha que o próprio Chrome mostraria pelo
 * convite da Lupa — os dois juntos seriam a mesma oferta duas vezes. O
 * "Instalar app" do menu do Chrome continua lá.
 */
export const SCRIPT_PEDIDO_DE_INSTALACAO = `
window.addEventListener("beforeinstallprompt", function (e) {
  e.preventDefault();
  window.__lupaPedidoDeInstalacao = e;
  window.dispatchEvent(new Event(${JSON.stringify(EVENTO_INSTALAVEL)}));
});
window.addEventListener("appinstalled", function () {
  window.__lupaPedidoDeInstalacao = null;
  window.__lupaInstalado = true;
  window.dispatchEvent(new Event(${JSON.stringify(EVENTO_INSTALAVEL)}));
});
`;
