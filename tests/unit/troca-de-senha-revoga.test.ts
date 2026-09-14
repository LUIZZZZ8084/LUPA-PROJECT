/**
 * Toda reescrita de senha derruba as sessões antigas (#230).
 *
 * A #225 pôs o corte de revogação **dentro** da instrução que grava a
 * senha, e escreveu o porquê: um segundo passo é o que alguém esquece no
 * terceiro caminho de troca de senha.
 *
 * Esqueci na irmã quatro horas depois. `scripts/criar-admin.mjs` escreve
 * direto na tabela, sem passar por `atualizarSenhaHash` — e é justamente o
 * script da #69, cujo objetivo é invalidar o que duas senhas vazadas
 * alcançam. Ele fecharia o buraco deixando-o aberto por sete dias.
 *
 * É a armadilha que o AGENTS.md nomeia desde a #142: *quando duas funções
 * produzem o mesmo efeito por caminhos diferentes, a regra corrigida numa
 * provavelmente falta na outra*. Este teste é o que tira isso da memória
 * de quem revisa.
 *
 * **Só `update`, nunca `insert`.** Conta que acabou de nascer não tem
 * sessão anterior para derrubar, e pôr o corte ali só encheria por sete
 * dias a lista que a #225 mantém curta de propósito.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

const RAIZES = [join(process.cwd(), "src"), join(process.cwd(), "scripts")];

function arquivos(dir: string): string[] {
  const achados: string[] = [];
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) achados.push(...arquivos(caminho));
    else if (/\.(ts|tsx|mjs)$/.test(nome)) achados.push(caminho);
  }
  return achados;
}

const curto = (caminho: string) =>
  relative(process.cwd(), caminho).split(sep).join("/");

/**
 * Os blocos `.update({ ... })` de um arquivo, com o miolo.
 *
 * Ingênuo de propósito: casa até a primeira `})`, o que basta para os
 * objetos literais que este projeto escreve. Um `update` montado por
 * variável escaparia — e escaparia de qualquer varredura de texto. O que
 * se defende aqui é o esquecimento, não a fraude.
 */
function blocosDeUpdate(fonte: string): string[] {
  return [...fonte.matchAll(/[.]update[(][{]([\s\S]*?)[}][)]/g)].map(
    (m) => m[1],
  );
}

describe("troca de senha e revogação andam juntas", () => {
  it("nenhum update reescreve senha_hash sem gravar o corte", () => {
    const faltando: string[] = [];

    for (const raiz of RAIZES) {
      for (const arquivo of arquivos(raiz)) {
        for (const bloco of blocosDeUpdate(readFileSync(arquivo, "utf8"))) {
          if (!bloco.includes("senha_hash")) continue;
          if (bloco.includes("sessoes_validas_desde")) continue;
          faltando.push(curto(arquivo));
        }
      }
    }

    expect(
      faltando,
      "Reescrita de senha sem derrubar as sessões antigas.\n\n" +
        faltando.map((a) => `  • ${a}`).join("\n") +
        "\n\nGrave `sessoes_validas_desde` no mesmo `update` (#225). Quem " +
        "troca a senha desconfiando de invasão precisa que o invasor caia " +
        "— e duas instruções deixam uma janela em que a senha já mudou e " +
        "a sessão antiga ainda vale.",
    ).toEqual([]);
  });

  /**
   * O teste acima passa vazio se a varredura parar de achar os arquivos —
   * um `readdir` numa pasta errada, uma extensão fora da lista. Teste que
   * protege uma lista precisa provar que a lista não está vazia.
   */
  it("a varredura de fato alcança os dois lugares que escrevem senha", () => {
    const comSenha = RAIZES.flatMap(arquivos)
      .filter((a) =>
        blocosDeUpdate(readFileSync(a, "utf8")).some((b) =>
          b.includes("senha_hash"),
        ),
      )
      .map(curto);

    expect(comSenha).toContain("src/server/repositories/postgres.ts");
    expect(comSenha).toContain("scripts/criar-admin.mjs");
  });
});
