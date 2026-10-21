/**
 * Quem vê o convite para instalar, e o que o toque faz (#475).
 *
 * Os agentes de usuário são de navegadores de verdade: o que se testa é a
 * leitura que a Lupa faz do que cada um diz de si.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  aparelhoDoNavegador,
  EVENTO_INSTALAVEL,
  ofertaDeInstalacao,
  SCRIPT_PEDIDO_DE_INSTALACAO,
} from "@/lib/instalacao";

const UA = {
  safariIphone:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1",
  chromeIphone:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/138.0.7204.156 Mobile/15E148 Safari/604.1",
  // O iPad se apresenta como Mac desde o iPadOS 13.
  safariMacOuIpad:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15",
  instagramIphone:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 390.0.0.28.85 (iPhone15,3; iOS 18_5; pt_BR; pt; scale=3.00; 1290x2796)",
  facebookIphone:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/500.0.0.40.98;FBBV/700000000;FBDV/iPhone15,3;FBMD/iPhone;FBSN/iOS;FBSV/18.5;FBSS/3;FBCR/;FBID/phone;FBLC/pt_BR;FBOP/80]",
  // Uma tela embutida qualquer: sem `Safari/`, não é o Safari.
  embutidaIphone:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
  chromeAndroid:
    "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36",
  samsungAndroid:
    "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/27.0 Chrome/125.0.0.0 Mobile Safari/537.36",
  webviewAndroid:
    "Mozilla/5.0 (Linux; Android 14; Pixel 7 Build/AP2A.240805.005; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/138.0.7204.63 Mobile Safari/537.36",
  instagramAndroid:
    "Mozilla/5.0 (Linux; Android 14; SM-A546E Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/138.0.7204.63 Mobile Safari/537.36 Instagram 390.0.0.43.81 Android (34/14; 450dpi; 1080x2340; samsung; SM-A546E; a54x; s5e8835; pt_BR; 700000000)",
  chromeWindows:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
  chromeLinux:
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
};

describe("aparelhoDoNavegador", () => {
  it.each([
    ["o Safari do iPhone", UA.safariIphone, 5, "iphone"],
    ["o Chrome do iPhone", UA.chromeIphone, 5, "iphone"],
    ["o iPad, que se diz Mac mas tem toque", UA.safariMacOuIpad, 5, "iphone"],
    ["o Chrome do Android", UA.chromeAndroid, 5, "android"],
    ["o navegador da Samsung", UA.samsungAndroid, 5, "android"],
    ["o Instagram no iPhone", UA.instagramIphone, 5, "app-embutido"],
    ["o Facebook no iPhone", UA.facebookIphone, 5, "app-embutido"],
    ["uma tela embutida no iPhone", UA.embutidaIphone, 5, "app-embutido"],
    ["o Instagram no Android", UA.instagramAndroid, 5, "app-embutido"],
    ["uma WebView no Android", UA.webviewAndroid, 5, "app-embutido"],
    ["o Mac, sem toque", UA.safariMacOuIpad, 0, "computador"],
    ["o Windows", UA.chromeWindows, 0, "computador"],
    // Tela de toque no notebook não faz dele um celular.
    ["o Windows com tela de toque", UA.chromeWindows, 10, "computador"],
    ["o Linux", UA.chromeLinux, 0, "computador"],
  ] as const)("%s", (_nome, ua, toques, esperado) => {
    expect(aparelhoDoNavegador(ua, toques)).toBe(esperado);
  });
});

describe("ofertaDeInstalacao", () => {
  const base = {
    aparelho: "android" as const,
    instalado: false,
    dispensado: false,
    temPedido: false,
  };

  it("cada aparelho recebe o seu caminho", () => {
    expect(ofertaDeInstalacao({ ...base, aparelho: "iphone" })).toBe(
      "dica-iphone",
    );
    expect(ofertaDeInstalacao({ ...base, aparelho: "app-embutido" })).toBe(
      "abrir-no-navegador",
    );
    expect(ofertaDeInstalacao(base)).toBe("dica-android");
  });

  it("o Android instala direto só quando o navegador entregou o pedido", () => {
    expect(ofertaDeInstalacao({ ...base, temPedido: true })).toBe(
      "instalar-direto",
    );
    // O iPhone não tem pedido nenhum; se tivesse, não mudaria nada.
    expect(
      ofertaDeInstalacao({ ...base, aparelho: "iphone", temPedido: true }),
    ).toBe("dica-iphone");
  });

  it("no computador, nunca", () => {
    expect(
      ofertaDeInstalacao({ ...base, aparelho: "computador", temPedido: true }),
    ).toBe("nenhuma");
  });

  it("com o app já instalado, nunca", () => {
    expect(
      ofertaDeInstalacao({ ...base, instalado: true, temPedido: true }),
    ).toBe("nenhuma");
  });

  it('"Agora não" esconde, mesmo com o pedido entregue', () => {
    expect(
      ofertaDeInstalacao({ ...base, dispensado: true, temPedido: true }),
    ).toBe("nenhuma");
  });
});

/*
 * O script do `<head>` roda de verdade, no `window` do jsdom: é ele que
 * guarda o pedido antes de o React existir.
 */
describe("o script do <head>", () => {
  afterEach(() => {
    window.__lupaPedidoDeInstalacao = undefined;
    window.__lupaInstalado = undefined;
  });

  it("guarda o pedido, cala a barrinha do navegador e avisa", () => {
    new Function(SCRIPT_PEDIDO_DE_INSTALACAO)();
    const avisado = vi.fn();
    window.addEventListener(EVENTO_INSTALAVEL, avisado);

    const pedido = new Event("beforeinstallprompt", { cancelable: true });
    window.dispatchEvent(pedido);

    expect(pedido.defaultPrevented).toBe(true);
    expect(window.__lupaPedidoDeInstalacao).toBe(pedido);
    expect(avisado).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new Event("appinstalled"));
    expect(window.__lupaPedidoDeInstalacao).toBeNull();
    expect(window.__lupaInstalado).toBe(true);
    expect(avisado).toHaveBeenCalledTimes(2);

    window.removeEventListener(EVENTO_INSTALAVEL, avisado);
  });
});
