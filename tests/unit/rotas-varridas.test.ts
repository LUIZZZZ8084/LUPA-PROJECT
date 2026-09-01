/**
 * @vitest-environment node
 *
 * Toda rota do app está em alguma varredura.
 *
 * As listas de `tests/e2e/rotas.ts` são escritas à mão, e lista escrita à
 * mão envelhece em silêncio: `/candidatos`, `/candidatos/[id]` e
 * `/perfil/candidaturas` nasceram depois dela e nunca passaram por
 * contraste WCAG nem por varredura de rolagem horizontal. Nada quebrou —
 * é exatamente esse o problema. A suíte continuou verde com 304 testes
 * enquanto quatro telas cresciam sem nenhum.
 *
 * Este contrato varre o código-fonte, como o de cidades e o de cards:
 * compara os `page.tsx` que existem em `src/app` com o que as listas
 * cobrem, e reprova quando aparece rota nova fora de todas elas. Excluir é
 * permitido — excluir em silêncio não, e é para isso que existe
 * `ROTAS_NAO_VARRIDAS`, onde cada ausência precisa dizer a razão.
 */
import { readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { ROTAS, ROTAS_EMPRESA, ROTAS_NAO_VARRIDAS } from "../e2e/rotas";

const RAIZ = join(process.cwd(), "src", "app");

/** Todo arquivo `page.tsx` sob `src/app`, com o caminho no disco. */
function paginas(dir: string): string[] {
  const achadas: string[] = [];

  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) {
      achadas.push(...paginas(caminho));
    } else if (nome === "page.tsx") {
      achadas.push(caminho);
    }
  }

  return achadas;
}

/**
 * De `src/app/(app)/vagas/[id]/page.tsx` para `/vagas/[id]`.
 *
 * Grupos de rota — as pastas entre parênteses — não aparecem na URL. É o
 * que permite `(inicio)` e `(lista)` escoparem um `loading.tsx` sem mudar
 * o endereço, e é a razão de a conversão ser aqui e não uma string à mão.
 */
function rotaDe(caminho: string): string {
  const partes = relative(RAIZ, caminho)
    .split(sep)
    .slice(0, -1)
    .filter((p) => !p.startsWith("("));

  return `/${partes.join("/")}`;
}

/** Uma rota da lista de varredura, sem a query string. */
function semQuery(path: string): string {
  return path.split("?")[0];
}

/**
 * Se um caminho concreto atende a uma rota com segmento dinâmico.
 *
 * A varredura visita `/vagas/job-operador-maquinas`, e o que existe no
 * disco é `/vagas/[id]`. Comparar as duas strings direto acusaria a rota
 * como não varrida — e a correção óbvia seria pôr `[id]` na lista, que é
 * uma URL que não existe. O padrão vira expressão: `[id]` casa com um
 * segmento qualquer, `[...slug]` com o resto do caminho.
 */
function cobre(padrao: string, concreto: string): boolean {
  const expressao = padrao
    .split("/")
    .map((parte) => {
      if (parte.startsWith("[...")) return ".+";
      if (parte.startsWith("[")) return "[^/]+";
      return parte.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    })
    .join("/");

  return new RegExp(`^${expressao}$`).test(concreto);
}

describe("varredura de rotas", () => {
  const todas = paginas(RAIZ).map(rotaDe);

  it("acha as páginas do app — se não achar, o resto não prova nada", () => {
    expect(todas.length).toBeGreaterThanOrEqual(15);
    expect(todas).toContain("/vagas");
    expect(todas).toContain("/empresa");
  });

  it("toda rota está numa varredura ou tem exclusão justificada", () => {
    const varridas = [...ROTAS, ...ROTAS_EMPRESA].map((r) => semQuery(r.path));

    const descobertas = todas.filter(
      (rota) =>
        !varridas.some((visitada) => cobre(rota, visitada)) &&
        !(rota in ROTAS_NAO_VARRIDAS),
    );

    expect(
      descobertas,
      "rota nova fora de toda varredura. Acrescente a ROTAS (sessão de " +
        "candidato) ou ROTAS_EMPRESA, ou registre a razão da ausência em " +
        "ROTAS_NAO_VARRIDAS — em tests/e2e/rotas.ts",
    ).toEqual([]);
  });

  it("nenhuma exclusão sobrevive à rota que a justificava", () => {
    const orfas = Object.keys(ROTAS_NAO_VARRIDAS).filter(
      (rota) => !todas.includes(rota),
    );

    expect(
      orfas,
      "a rota não existe mais; tire a exclusão de ROTAS_NAO_VARRIDAS",
    ).toEqual([]);
  });

  it("cada exclusão diz a razão, e não só que existe", () => {
    for (const [rota, razao] of Object.entries(ROTAS_NAO_VARRIDAS)) {
      expect(razao.length, `${rota} sem razão escrita`).toBeGreaterThan(30);
    }
  });

  it("nenhuma rota está nas duas listas — a sessão certa é uma só", () => {
    const deCandidato = new Set(ROTAS.map((r) => semQuery(r.path)));
    const repetidas = ROTAS_EMPRESA.filter((r) =>
      deCandidato.has(semQuery(r.path)),
    ).map((r) => r.path);

    expect(repetidas).toEqual([]);
  });
});
