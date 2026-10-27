import { describe, expect, it } from "vitest";
import { ehRastreador } from "@/lib/rastreador";

/**
 * Robô de prévia não é visualização de vaga (#490).
 *
 * A vaga abre sem login, e colar o link numa conversa manda um servidor
 * buscar a página. Contar isso faria o número da empresa subir quando ela
 * divulga — mede o robô, não o público.
 */
describe("ehRastreador", () => {
  it.each([
    "WhatsApp/2.23.20.0",
    "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
    "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
    "TelegramBot (like TwitterBot)",
    "Twitterbot/1.0",
    "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)",
    "LinkedInBot/1.0 (compatible; Mozilla/5.0; +http://www.linkedin.com)",
    "Mozilla/5.0 (X11; Linux x86_64) HeadlessChrome/120.0",
  ])("%s é robô", (ua) => {
    expect(ehRastreador(ua)).toBe(true);
  });

  it.each([
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",
    // O navegador embutido do Instagram abre a vaga como uma pessoa.
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Instagram 300.0.0.0",
  ])("navegador de gente não é robô: %s", (ua) => {
    expect(ehRastreador(ua)).toBe(false);
  });

  /**
   * Sem `User-Agent` não é navegador. Quem chega assim é script, e contá-lo
   * como pessoa seria o erro para o lado que infla o número.
   */
  it("sem User-Agent, trata como robô", () => {
    expect(ehRastreador(null)).toBe(true);
    expect(ehRastreador(undefined)).toBe(true);
    expect(ehRastreador("")).toBe(true);
  });
});
