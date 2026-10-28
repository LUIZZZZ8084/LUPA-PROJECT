/**
 * @vitest-environment node
 *
 * O AGENTS.md cabe no limite de leitura, e o índice dele diz a verdade (#509).
 *
 * O arquivo é lido inteiro por todo agente em toda sessão, até um limite. Em
 * 27/10/2026 ele tinha 228 mil caracteres para um limite de 150 mil, e as
 * seções do fim — as mais novas — não eram lidas, sem nada ficar vermelho.
 * As decisões foram para `docs/decisoes/`, com um índice no AGENTS.md. O que
 * se cobra aqui é o que faz a divisão continuar valendo: o tamanho, e o
 * índice batendo com a pasta — índice que esquece um arquivo é decisão que
 * nenhum agente abre.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = process.cwd();
const AGENTS = readFileSync(join(RAIZ, "AGENTS.md"), "utf8");
const PASTA = join(RAIZ, "docs", "decisoes");

/** O limite do Claude Code é 150 mil; a folga é para o arquivo poder crescer. */
const TETO_DE_CARACTERES = 100_000;

/** Cada tema do índice: o arquivo e os títulos de seção listados embaixo. */
function temasDoIndice(): { arquivo: string; secoes: string[] }[] {
  const temas: { arquivo: string; secoes: string[] }[] = [];
  let atual: { arquivo: string; secoes: string[] } | null = null;
  for (const linha of AGENTS.split("\n")) {
    const link = /^### \[.+\]\(docs\/decisoes\/([^)]+\.md)\)$/.exec(linha);
    if (link) {
      atual = { arquivo: link[1], secoes: [] };
      temas.push(atual);
      continue;
    }
    if (atual && linha.startsWith("- ")) atual.secoes.push(linha.slice(2));
    if (linha.startsWith("## ")) atual = null;
  }
  return temas;
}

describe("AGENTS.md", () => {
  it(`fica abaixo de ${TETO_DE_CARACTERES.toLocaleString("pt-BR")} caracteres`, () => {
    expect(
      [...AGENTS].length,
      "decisão nova vai em docs/decisoes/, no arquivo do tema — não no AGENTS.md",
    ).toBeLessThan(TETO_DE_CARACTERES);
  });

  it("todo arquivo de docs/decisoes/ está no índice", () => {
    const naPasta = readdirSync(PASTA).filter((f) => f.endsWith(".md"));
    const noIndice = temasDoIndice().map((t) => t.arquivo);
    expect(naPasta.sort()).toEqual([...noIndice].sort());
  });

  it("todo link do índice aponta para um arquivo que existe", () => {
    for (const { arquivo } of temasDoIndice()) {
      expect(existsSync(join(PASTA, arquivo)), arquivo).toBe(true);
    }
  });

  it("cada seção listada no índice existe no arquivo do tema", () => {
    for (const { arquivo, secoes } of temasDoIndice()) {
      const conteudo = readFileSync(join(PASTA, arquivo), "utf8");
      const titulos = new Set(
        conteudo
          .split("\n")
          .filter((l) => l.startsWith("## "))
          .map((l) => l.slice(3)),
      );
      for (const secao of secoes) {
        expect(titulos.has(secao), `${arquivo}: "${secao}"`).toBe(true);
      }
    }
  });

  it("continua com o que vale para qualquer tarefa", () => {
    for (const secao of [
      "## Fluxo de trabalho obrigatório",
      "## Como o app está montado",
      "## Convenções",
      "## Armadilhas que já custaram caro",
    ]) {
      expect(AGENTS).toContain(secao);
    }
  });
});
