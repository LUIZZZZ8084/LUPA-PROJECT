/**
 * O cache das listagens não pode guardar a lista de uma pessoa (#206).
 *
 * Cachear leitura é economia; cachear **a leitura errada** é servir a
 * resposta de alguém para outra pessoa. A linha entre as duas é uma só: a
 * chave do cache não pode conter nada de sessão.
 *
 * Por isso este arquivo testa o código-fonte, e não o comportamento. O
 * comportamento errado aqui não falha — ele funciona, rápido, mostrando a
 * coisa errada. É o modo de falha que o AGENTS.md registra como o mais
 * caro: nada fica vermelho.
 *
 * O segundo teste cobra uma dupla que este projeto já esqueceu duas vezes.
 * `revalidatePath` escrito à mão ficou para trás na #189 e de novo na #193,
 * em arquivos irmãos — e agora esquecer tem consequência pior, porque a
 * página revalida e a consulta por baixo dela não.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(process.cwd(), "src");

function arquivos(dir: string, extensoes: string[]): string[] {
  const achados: string[] = [];
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) {
      achados.push(...arquivos(caminho, extensoes));
    } else if (extensoes.some((e) => nome.endsWith(e))) {
      achados.push(caminho);
    }
  }
  return achados;
}

const curto = (caminho: string) =>
  caminho.replace(/\\/g, "/").split("/src/")[1];

describe("cache das listagens", () => {
  /**
   * O que não pode entrar na chave.
   *
   * `perto` é o caso concreto e o mais tentador: ele chega junto dos
   * filtros, em `JobFilters`, e parece mais um deles. Não é — ele é quem
   * está olhando. Se ele entrasse na chave, o cache continuaria correto,
   * só que inútil (uma entrada por bairro); se a **ordenação** entrasse no
   * trecho cacheado, aí sim a lista de um bairro seria servida a outro.
   */
  it("a chave do cache não carrega sessão nem quem está olhando", () => {
    const fonte = readFileSync(join(SRC, "lib", "data.ts"), "utf8");

    for (const bloco of fonte.split("const chave = [").slice(1)) {
      const chave = bloco.split("]")[0];

      for (const proibido of [
        "perto",
        "sessao",
        "usuarioId",
        "usuario",
        "papel",
        "cookie",
      ]) {
        expect(
          chave.includes(proibido),
          `A chave do cache menciona "${proibido}".\n\n` +
            `Chave encontrada: [${chave.trim()}]\n\n` +
            "A chave descreve **o que** se pede, nunca **quem** pede. " +
            "Ordenação por proximidade acontece depois, em memória, e é o " +
            "que mantém a resposta guardada impessoal.",
        ).toBe(false);
      }
    }
  });

  /**
   * Cache tem que ser derrubado por quem escreve, e a página revalidada
   * junto. Chamar só uma das duas é o defeito silencioso: o painel mostra
   * a vaga nova e a busca não.
   */
  it("ninguém revalida a busca sem derrubar o cache dela", () => {
    const soltos: string[] = [];

    for (const arquivo of arquivos(join(SRC, "app"), [".ts", ".tsx"])) {
      const fonte = readFileSync(arquivo, "utf8");
      if (
        /revalidatePath\(\s*"\/vagas"\s*\)/.test(fonte) ||
        /revalidatePath\(\s*"\/servicos"\s*\)/.test(fonte)
      ) {
        soltos.push(curto(arquivo));
      }
    }

    expect(
      soltos,
      "revalidatePath da busca chamado direto.\n\n" +
        soltos.map((a) => `  • ${a}`).join("\n") +
        "\n\nUse `revalidarBuscaDeVagas()` ou " +
        "`revalidarBuscaDePrestadores()` de `@/lib/cache-de-listagem`: " +
        "elas fazem as duas chamadas que precisam andar juntas.",
    ).toEqual([]);
  });

  /**
   * A janela decide quanto tempo a tela pode mentir. A home promete "novas
   * vagas entram todo dia" e vaga boa em Sinop some em dois dias — cache
   * longo aqui quebraria a promessa da própria tela.
   */
  it("a janela é curta", () => {
    /*
     * Lido da fonte, e não importado: o módulo é `server-only` e chama
     * `next/cache`, que precisa de contexto de requisição para existir.
     * Importá-lo aqui trava o teste — e um teste que trava é pior que um
     * teste que não existe, porque some dentro de um timeout genérico.
     */
    const fonte = readFileSync(
      join(SRC, "lib", "cache-de-listagem.ts"),
      "utf8",
    );
    const declarado = /JANELA_DE_CACHE\s*=\s*(\d+)/.exec(fonte)?.[1];

    expect(declarado, "JANELA_DE_CACHE não encontrada").toBeDefined();
    expect(Number(declarado)).toBeGreaterThan(0);
    expect(Number(declarado)).toBeLessThanOrEqual(300);
  });

  /**
   * O cliente cacheado não pode ler cookie — e não é questão de estilo:
   * `cookies()` é dado de requisição, e dado de requisição não existe
   * dentro de um cache. Usar o cliente errado ali é erro em execução.
   */
  it("a leitura cacheada usa o cliente sem cookie", () => {
    const fonte = readFileSync(join(SRC, "lib", "data.ts"), "utf8");

    for (const bloco of fonte.split("const chave = [").slice(1)) {
      const antes = fonte.slice(0, fonte.indexOf(bloco));
      const trecho = antes.slice(-600);

      expect(
        trecho.includes("clientePublico()"),
        "Leitura cacheada precisa do cliente sem cookie (`clientePublico`).",
      ).toBe(true);
    }
  });
});
