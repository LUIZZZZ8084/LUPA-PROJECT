/**
 * Nenhuma consulta de lista sai daqui sem teto de linhas (#203).
 *
 * A varredura que originou esta Issue achou 23 consultas trazendo linha
 * sem limite nenhum. Nada quebrava: com 8 vagas, `select *` sem teto é
 * indistinguível de `select *` com teto. O estrago aparece sozinho quando
 * a base cresce, e aparece como lentidão e conta, não como erro — o modo
 * de falha mais difícil de atribuir a uma causa.
 *
 * Por isso a proteção é um teste que lê o código-fonte, e não um teste de
 * comportamento: o risco não é o teto estar errado, é a **consulta número
 * 24** nascer sem teto. É a mesma disciplina de `ROTAS_NAO_VARRIDAS` e da
 * varredura de `revoke` no schema — quando a cobertura é uma lista,
 * alguém precisa cobrar a lista.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RAIZES = [
  join(process.cwd(), "src", "lib"),
  join(process.cwd(), "src", "server"),
];

/**
 * Consultas que a varredura acusa e que não são lista, com a razão.
 *
 * Não é lista de perdoadas: é lista de **falso positivo**, e a diferença
 * importa. A varredura acha o fim da cadeia pelo `;`, e uma consulta
 * montada em pedaços (`let consulta = ...; if (x) consulta = ...`) engana
 * o leitor e o regex do mesmo jeito. Quem acrescentar aqui precisa dizer
 * por que aquela consulta traz no máximo uma linha.
 */
const NAO_SAO_LISTA: Record<string, string> = {
  "repositories/postgres.ts:perfis_empresa":
    'cnpjEmUso: `.eq("cnpj", ...)` com `.maybeSingle()`, montada em duas ' +
    "etapas por causa do `exceto` opcional — a varredura perde o fim da " +
    "cadeia, não o limite.",
  "repositories/postgres.ts:perfis_prestador":
    "a irmã da anterior, no outro perfil que pode ter CNPJ, e pelo mesmo " +
    "motivo.",
};

function arquivosTs(dir: string): string[] {
  const achados: string[] = [];
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) achados.push(...arquivosTs(caminho));
    else if (nome.endsWith(".ts")) achados.push(caminho);
  }
  return achados;
}

interface Consulta {
  arquivo: string;
  linha: number;
  tabela: string;
  chave: string;
}

/**
 * Consultas que trazem linhas e não declaram teto.
 *
 * O que exclui uma consulta desta lista: pedir uma linha só
 * (`single`/`maybeSingle`), contar sem trazer (`count` + `head`), ou já
 * ter `limit`/`range`.
 */
function semTeto(): Consulta[] {
  const achados: Consulta[] = [];

  for (const raiz of RAIZES) {
    for (const arquivo of arquivosTs(raiz)) {
      const linhas = readFileSync(arquivo, "utf8")
        .replace(/\r\n/g, "\n")
        .split("\n");

      for (let i = 0; i < linhas.length; i += 1) {
        if (!linhas[i].includes('.from("')) continue;

        const trecho: string[] = [];
        for (let j = i; j < Math.min(i + 30, linhas.length); j += 1) {
          trecho.push(linhas[j]);
          const fim = linhas[j].trimEnd();
          if (fim.endsWith(";") || fim.endsWith("),")) break;
        }
        const cadeia = trecho.join("\n");

        if (!cadeia.includes(".select(")) continue; // insert/update/delete
        if (/\.(single|maybeSingle)\(\)/.test(cadeia)) continue;
        if (/\.(limit|range)\(/.test(cadeia)) continue;
        if (cadeia.includes("count:") && cadeia.includes("head: true"))
          continue;

        const tabela = /\.from\("([^"]+)"\)/.exec(cadeia)?.[1] ?? "?";
        const curto = arquivo
          .replace(/\\/g, "/")
          .split("/src/")[1]
          .replace(/^(lib|server)\//, "");

        achados.push({
          arquivo: curto,
          linha: i + 1,
          tabela,
          chave: `${curto}:${tabela}`,
        });
      }
    }
  }

  return achados;
}

describe("teto nas listagens", () => {
  /**
   * Se a varredura parar de achar consulta nenhuma, o teste vira verde
   * sem medir nada — o modo de falha mais perigoso de quem lê
   * código-fonte.
   */
  it("a varredura enxerga as consultas do projeto", () => {
    const arquivos = RAIZES.flatMap(arquivosTs);
    const comConsulta = arquivos.filter((a) =>
      readFileSync(a, "utf8").includes('.from("'),
    );
    expect(comConsulta.length).toBeGreaterThanOrEqual(10);
  });

  it("toda consulta de lista declara teto", () => {
    const orfas = semTeto().filter((c) => !(c.chave in NAO_SAO_LISTA));

    expect(
      orfas,
      "Consulta trazendo linhas sem teto.\n\n" +
        orfas
          .map((c) => `  • ${c.arquivo}:${c.linha}  ${c.tabela}`)
          .join("\n") +
        "\n\nAcrescente `.limit(...)` com uma constante de " +
        "`src/lib/limites-de-lista.ts`. Se ela traz no máximo uma linha e a " +
        "varredura se enganou, registre em NAO_SAO_LISTA — com o porquê.",
    ).toEqual([]);
  });

  /**
   * Dispensa que sobrou depois de a consulta mudar é justificativa órfã:
   * alguém lê, acredita, e deixa de conferir o que já não é verdade.
   */
  it("não sobra dispensa para consulta que não existe mais", () => {
    const vistas = new Set(semTeto().map((c) => c.chave));
    const sobrando = Object.keys(NAO_SAO_LISTA).filter((c) => !vistas.has(c));

    expect(sobrando, "NAO_SAO_LISTA cita consulta inexistente").toEqual([]);
  });
});
