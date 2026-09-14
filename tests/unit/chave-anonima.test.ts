/**
 * A chave anônima não pode ir para o navegador (#221).
 *
 * `NEXT_PUBLIC_` não é convenção de nome: é uma **instrução ao Next** para
 * embutir o valor no JavaScript do navegador. A chave anônima era lida de
 * `NEXT_PUBLIC_SUPABASE_ANON_KEY`, ou seja, o nome declarava que ela era
 * publicável.
 *
 * Ela nunca chegou a ser publicada — conferido no bundle de produção, HTML
 * e os onze chunks —, e o motivo é que nada no cliente usa Supabase: não
 * existe módulo de cliente de navegador, e o Next só embute `NEXT_PUBLIC_*`
 * onde a variável é referenciada.
 *
 * **Isso era sorte de arranjo, não garantia.** Um `"use client"` novo
 * importando `isSupabaseConfigured` — coisa razoável de se fazer — mandaria
 * a chave para o bundle sem nada quebrar e sem nada ficar vermelho. É o
 * modo de falha que este projeto trata como o mais caro.
 *
 * Quem tiver a chave lê `provider_listings` inteira, com o telefone de cada
 * prestador, sem login — e isso contraria a decisão de 21/08/2026, que
 * tirou o app da busca do Google justamente para pôr o dado atrás do muro.
 *
 * A garantia de verdade é o `import "server-only"`, que transforma o
 * vazamento em erro de build. Estes testes existem para que alguém não o
 * remova achando que é decoração.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const raiz = (...partes: string[]) => join(process.cwd(), ...partes);

describe("a chave anônima do Supabase", () => {
  const config = readFileSync(
    raiz("src", "lib", "supabase", "config.ts"),
    "utf8",
  );

  it("é lida sem prefixo NEXT_PUBLIC_", () => {
    expect(config).toMatch(/process\.env\.SUPABASE_ANON_KEY/);
  });

  /**
   * O módulo é `server-only`: é ele que faz um import de cliente virar erro
   * de build em vez de uma chave embutida em silêncio. Sem esta linha, todo
   * o resto deste arquivo vira documentação de uma intenção.
   */
  it("mora num módulo que o cliente não consegue importar", () => {
    expect(config).toMatch(/^import "server-only";/m);
  });

  /**
   * O nome antigo continua aceito de propósito, enquanto a Vercel não for
   * atualizada — derrubar produção por causa de um nome de variável
   * trocaria risco hipotético por indisponibilidade real.
   *
   * Este teste é o lembrete de que a linha é temporária: quando
   * `SUPABASE_ANON_KEY` existir em produção e a antiga for apagada, o
   * fallback sai, e é aqui que alguém percebe.
   */
  it("ainda aceita o nome antigo, e isso é transitório", () => {
    expect(config).toMatch(/NEXT_PUBLIC_SUPABASE_ANON_KEY/);
  });

  /**
   * A URL continua pública e pode: é um hostname, e `next.config.ts`
   * precisa dela em tempo de build para liberar o otimizador de imagem.
   * Conhecer o endereço não dá acesso a nada.
   */
  it("a URL segue pública, que é outra coisa", () => {
    expect(config).toMatch(/NEXT_PUBLIC_SUPABASE_URL/);
  });

  /**
   * A suíte e2e zerando só o nome antigo falaria com o banco de verdade
   * pelo nome novo. Não é hipótese: o ajudante de login já criou 213 contas
   * na base real quando essa proteção faltou.
   */
  it("a suíte e2e zera os dois nomes", () => {
    const playwright = readFileSync(raiz("playwright.config.ts"), "utf8");
    expect(playwright).toMatch(/SUPABASE_ANON_KEY:\s*""/);
    expect(playwright).toMatch(/NEXT_PUBLIC_SUPABASE_ANON_KEY:\s*""/);
  });
});
