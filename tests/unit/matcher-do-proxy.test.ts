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

  it.each(["/", "/vagas", "/perfil", "/admin", "/entrar"])(
    "%s passa pelo proxy",
    (caminho) => {
      expect(casa(caminho)).toBe(true);
    },
  );
});
