/**
 * Toda server action tem teto — ou uma razão escrita para não ter (#202).
 *
 * Este teste varre o código-fonte em vez de conferir comportamento, e é
 * de propósito. O risco real não é o teto estar errado: é a **ação número
 * 32** nascer sem teto nenhum e ninguém perceber, porque nada quebra
 * quando falta limite. Portão que falta não derruba tela, e o que se perde
 * é a garantia de que a matriz é a fonte da verdade.
 *
 * É a mesma disciplina de `ROTAS_NAO_VARRIDAS`, pela mesma lição que o
 * AGENTS.md registra: quando a cobertura de um teste é uma lista, alguém
 * precisa cobrar a lista.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ORCAMENTOS, SEM_ORCAMENTO } from "@/server/limites";

const RAIZ = join(process.cwd(), "src", "app");

/**
 * Os nomes declarados em `criarAcao({ nome: "..." })`.
 *
 * A busca é ancorada em `criarAcao(` e não em `nome:` solto porque `nome`
 * é campo comum — `AreaDeContratacao` tem um, e ele apareceria aqui como
 * se fosse uma action chamada "Minha Empresa".
 */
function arquivosTs(dir: string): string[] {
  const achados: string[] = [];
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) {
      achados.push(...arquivosTs(caminho));
    } else if (nome.endsWith(".ts")) {
      achados.push(caminho);
    }
  }
  return achados;
}

function nomesDasAcoes(): { nome: string; arquivo: string }[] {
  const achados: { nome: string; arquivo: string }[] = [];

  for (const arquivo of arquivosTs(RAIZ)) {
    const fonte = readFileSync(arquivo, "utf8");
    for (const bloco of fonte.split("criarAcao({").slice(1)) {
      const nome = /^\s*nome:\s*"([^"]+)"/m.exec(bloco);
      if (nome) {
        achados.push({ nome: nome[1], arquivo: arquivo.replace(/\\/g, "/") });
      }
    }
  }
  return achados;
}

describe("teto das server actions", () => {
  it("encontra as actions do app", () => {
    const acoes = nomesDasAcoes();
    // Se a varredura parar de achar, o resto deste arquivo passa a verde
    // sem testar nada — o modo de falha mais perigoso de um teste que lê
    // código-fonte.
    expect(acoes.length).toBeGreaterThanOrEqual(25);
  });

  it("toda action tem orçamento, ou uma razão escrita para não ter", () => {
    const acoes = nomesDasAcoes();

    const orfas = acoes.filter(
      ({ nome }) => !(nome in ORCAMENTOS) && !(nome in SEM_ORCAMENTO),
    );

    expect(
      orfas,
      `Action sem teto e sem razão registrada.\n\n` +
        orfas
          .map((a) => `  • "${a.nome}" — ${a.arquivo.split("/src/")[1]}`)
          .join("\n") +
        `\n\nAcrescente em ORCAMENTOS (src/server/limites.ts) ou, se ela ` +
        `tiver limite próprio noutro lugar, em SEM_ORCAMENTO — com o porquê.`,
    ).toEqual([]);
  });

  /**
   * A lista de dispensas envelhece: a action sai, a razão fica, e meses
   * depois alguém lê uma justificativa para algo que não existe mais.
   */
  it("não sobra dispensa para action que não existe mais", () => {
    const acoes = new Set(nomesDasAcoes().map((a) => a.nome));
    const sobrando = Object.keys(SEM_ORCAMENTO).filter((n) => !acoes.has(n));

    expect(sobrando, "SEM_ORCAMENTO cita action inexistente").toEqual([]);
  });

  /** Orçamento sem ação é a mesma sobra, do outro lado da tabela. */
  it("não sobra orçamento para action que não existe mais", () => {
    const acoes = new Set(nomesDasAcoes().map((a) => a.nome));
    const sobrando = Object.keys(ORCAMENTOS).filter((n) => !acoes.has(n));

    expect(sobrando, "ORCAMENTOS cita action inexistente").toEqual([]);
  });

  /**
   * Número que não contém nada é pior que número nenhum: dá a impressão
   * de proteção e some do radar de quem revisa.
   */
  it("todo orçamento é um teto de verdade", () => {
    for (const [nome, orcamento] of Object.entries(ORCAMENTOS)) {
      expect(orcamento.chamadas, `${nome}: teto`).toBeGreaterThan(0);
      expect(orcamento.chamadas, `${nome}: teto alto demais`).toBeLessThan(200);
      expect(orcamento.janelaSegundos, `${nome}: janela`).toBeGreaterThan(0);
    }
  });
});
