/**
 * O que fica fora do muro do `proxy.ts`, e o que não pode ficar.
 *
 * O AGENTS.md chama o matcher de "o lugar onde um item esquecido não quebra
 * nada e ninguém vê", e registra três casos: o manifesto (o PWA deixou de
 * ser instalável para quem não tem conta), o webhook do Mercado Pago (o
 * pagamento entrava e nunca era confirmado) e o cron de reconciliação. Em
 * todos, quem chama não tem sessão, e o muro trocava a resposta por um
 * redirecionamento para `/entrar` — sem nenhuma tela quebrar.
 *
 * A prévia do link (#259) seria o quarto: o WhatsApp busca a imagem sem
 * sessão. Entrou na lista antes de quebrar, e este teste é o que cobra a
 * lista — o e2e de `muro-de-login.spec.ts` prova o comportamento, mas custa
 * um build; aqui a regra é lida direto da configuração.
 */
import { describe, expect, it } from "vitest";
import { config } from "@/proxy";

const casa = (caminho: string) =>
  config.matcher.some((padrao) => new RegExp(`^${padrao}$`).test(caminho));

describe("matcher do proxy", () => {
  it.each([
    "/manifest.webmanifest",
    "/robots.txt",
    "/sitemap.xml",
    "/icon",
    "/apple-icon",
    "/opengraph-image",
    "/api/webhooks/mercado-pago",
    "/api/cron/reconciliar-pagamentos",
    // O túnel do Sentry (#269): erro de quem não está logado se perdia.
    "/monitoring",
  ])("%s fica fora do muro — quem busca não tem sessão", (caminho) => {
    expect(casa(caminho)).toBe(false);
  });

  /*
   * O ponto antes da extensão é literal (#330). Sem o escape, todo
   * caminho terminado em "png", "gif" ou "svg" — com ou sem ponto — ficava
   * fora do muro.
   */
  it.each(["/vagas/acerto-gif", "/perfil/png", "/servicos/pintor-svg"])(
    "%s passa pelo proxy, mesmo terminando como extensão",
    (caminho) => {
      expect(casa(caminho)).toBe(true);
    },
  );

  /*
   * Sem âncora (#404), cada item era prefixo de texto: `icon` deixava
   * `/iconografia` fora do muro. E a exclusão por extensão deixava
   * qualquer caminho terminado em `.png` sem login e sem CSP.
   */
  it.each([
    "/iconografia",
    "/apple-icone",
    "/avatares-de-alguem",
    "/api/cronograma",
    "/api/webhooks-falsos",
    "/monitoramento",
    "/banners",
    "/vagas/abc.png",
    "/perfil/foto.webp",
    "/logo.svg",
  ])(
    "%s passa pelo proxy — não é item da lista, só começa como um",
    (caminho) => {
      expect(casa(caminho)).toBe(true);
    },
  );

  it.each([
    "/avatares/cmp-agro-norte.svg",
    "/banner/trabalhador-recortado-v2.webp",
    "/_next/static/chunks/main.js",
    "/_next/image",
    "/favicon.ico",
  ])("%s, arquivo estático, fica fora", (caminho) => {
    expect(casa(caminho)).toBe(false);
  });

  it.each(["/", "/vagas", "/perfil", "/admin", "/entrar"])(
    "%s passa pelo proxy",
    (caminho) => {
      expect(casa(caminho)).toBe(true);
    },
  );
});
