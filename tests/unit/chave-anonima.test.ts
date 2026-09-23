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
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

const raiz = (...partes: string[]) => join(process.cwd(), ...partes);

/**
 * O único lugar onde o nome antigo ainda aparece (#279).
 *
 * A Vercel foi atualizada em 23/09/2026 e o fallback de `config.ts` saiu.
 * Sobra a mensagem de `config-obrigatoria.ts`, que cita o nome antigo para
 * dizer a quem lê o deploy vermelho que a variável existe, só que com o
 * nome errado.
 */
const PODEM_CITAR = ["src/server/config-obrigatoria.ts"];

function arquivosDe(dir: string): string[] {
  const achados: string[] = [];
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) achados.push(...arquivosDe(caminho));
    else if (/[.]tsx?$/.test(nome)) achados.push(caminho);
  }
  return achados;
}

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
   * O fallback era transitório e saiu (#279). Voltar a lê-lo reabriria o
   * caminho pelo qual um `"use client"` embute a chave no bundle.
   */
  it("não lê mais o nome antigo", () => {
    expect(config).not.toMatch(/NEXT_PUBLIC_SUPABASE_ANON_KEY/);
  });

  /**
   * O nome antigo só pode aparecer na mensagem de arranque, que o cita
   * para explicar o conserto.
   *
   * `server-only` protege o **módulo**, não a **variável**. Um
   * `"use client"` que escreva
   * `process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY` direto não importa
   * `config.ts`, então não quebra o build — e o Next embute o valor no
   * bundle do navegador em silêncio. Quem o tiver lê `provider_listings`
   * inteira, com o telefone de cada prestador, sem login.
   *
   * Na Vercel a variável foi renomeada em 23/09/2026 (#279), o que fecha
   * isto por construção em produção: o Next só embute `NEXT_PUBLIC_*` que
   * existe. O teste continua porque o `.env.local` de quem desenvolve pode
   * ainda ter o nome antigo. *Ele defende o esquecimento, não a fraude:*
   * quem montar o nome por concatenação passa, e passaria por qualquer
   * varredura de texto.
   */
  it("o nome antigo não aparece fora da mensagem de arranque", () => {
    const fora: string[] = [];

    for (const arquivo of arquivosDe(raiz("src"))) {
      const curto = relative(process.cwd(), arquivo).split(sep).join("/");
      if (PODEM_CITAR.includes(curto)) continue;
      if (
        readFileSync(arquivo, "utf8").includes("NEXT_PUBLIC_SUPABASE_ANON_KEY")
      ) {
        fora.push(curto);
      }
    }

    expect(
      fora,
      "A chave anônima citada pelo nome publicável fora do servidor: " +
        fora.join(", ") +
        ". Com o prefixo NEXT_PUBLIC_, o Next embute o valor no bundle do " +
        "navegador, e quem o tiver lê telefone de todo prestador sem " +
        "login. Leia de @/lib/supabase/config, que é server-only.",
    ).toEqual([]);
  });

  /** Lista vazia por engano faria o teste acima passar sem medir nada. */
  it("a varredura alcança os arquivos que podem citar o nome", () => {
    for (const permitido of PODEM_CITAR) {
      expect(
        readFileSync(raiz(...permitido.split("/")), "utf8"),
        `${permitido} deixou de citar o nome — a lista envelheceu`,
      ).toContain("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    }
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
   * Quem roda sem banco precisa zerar o nome que o app lê. Zerar só o
   * antigo falaria com o banco de verdade pelo novo — e não é hipótese: o
   * ajudante de login já criou 213 contas na base real quando essa
   * proteção faltou.
   */
  it("a suíte e2e e o modo demonstração local zeram o nome que o app lê", () => {
    for (const arquivo of ["playwright.config.ts", "scripts/dev-demo.mjs"]) {
      const texto = readFileSync(raiz(...arquivo.split("/")), "utf8");
      expect(texto, arquivo).toMatch(/(?<!_)SUPABASE_ANON_KEY:\s*""/);
    }
  });
});
