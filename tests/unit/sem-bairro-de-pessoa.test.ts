/**
 * @vitest-environment node
 *
 * Bairro de pessoa não existe na Lupa (#321).
 *
 * Decisão do Luiz em 01/10/2026: o cadastro e o perfil pedem só a cidade, e
 * o bairro não filtra nem ordena nada. O único bairro que sobrou é o da
 * **vaga**, texto livre e opcional que a empresa escreve para quem decide
 * se vai até lá.
 *
 * O bairro de pessoa já tinha sido "removido" em silêncio duas vezes: o
 * enum caiu na abertura para Mato Grosso, e "Bairros atendidos" saiu do
 * perfil na #119 — e nas duas o campo sobreviveu em outro canto (a ordem da
 * busca, o selo "Perto de você", o cadastro). Por isso a trava é um teste
 * que lê o código-fonte: quem reintroduzir o campo num formulário, num tipo
 * ou na escada de proximidade reprova aqui, com a decisão na mensagem.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(process.cwd(), "src");

function arquivos(dir: string): string[] {
  const achados: string[] = [];
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) {
      achados.push(...arquivos(caminho));
    } else if (/\.(ts|tsx)$/.test(nome)) {
      achados.push(caminho);
    }
  }
  return achados;
}

const curto = (caminho: string) =>
  caminho.replace(/\\/g, "/").split("/src/")[1];

/** O código sem comentários: a decisão é citada neles, e isso é o certo. */
function codigo(caminho: string): string {
  return readFileSync(caminho, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const TODOS = arquivos(SRC).map((c) => ({
  caminho: curto(c),
  codigo: codigo(c),
}));

/**
 * Onde "bairro" ainda pode aparecer: só no que descreve a **vaga**.
 *
 * Cada linha é uma razão. Entrar aqui um arquivo que não fala de vaga é
 * justamente o que este teste existe para impedir.
 */
const FALA_DA_VAGA = [
  // O serviço, o schema e os dois repositórios de vaga.
  /^server\/vagas\//,
  // `zBairro` valida o texto livre da vaga.
  /^server\/validation\.ts$/,
  // O formulário de publicar e a revisão antes de publicar.
  /^app\/\(app\)\/_contratacao\/(nova-vaga-form|revisao)\.tsx$/,
  // A vaga na tela: card e detalhe.
  /^components\/job-card\.tsx$/,
  /^app\/\(app\)\/vagas\/\[id\]\/page\.tsx$/,
  // O tipo `Job` e o mapa vaga ↔ mock; o mock em si é só de vaga.
  /^lib\/types\.ts$/,
  /^lib\/data\.ts$/,
  /^lib\/mock-data\.ts$/,
];

const PALAVRA = /bairro|neighborhood/i;

describe("bairro de pessoa não volta", () => {
  it("só os arquivos que falam da vaga mencionam bairro", () => {
    const intrusos = TODOS.filter(
      (a) =>
        PALAVRA.test(a.codigo) && !FALA_DA_VAGA.some((r) => r.test(a.caminho)),
    ).map((a) => a.caminho);

    expect(
      intrusos,
      "bairro só existe na vaga (#321). Se o arquivo abaixo trata de vaga, " +
        "acrescente-o a FALA_DA_VAGA com a razão; se trata de pessoa, o " +
        "campo não volta — a decisão está em AGENTS.md",
    ).toEqual([]);
  });

  /*
   * Os nomes que carregavam o bairro de pessoa. Nenhum deles pode existir
   * em lugar nenhum, nem nos arquivos da vaga: `service_area` e
   * `bairrosAtendidos` eram o bairro do prestador, `MESMO_BAIRRO` o degrau
   * da escada, e o resto a lista curada de Sinop que alimentava a tela.
   */
  it("os nomes da área de atendimento e do degrau de bairro saíram", () => {
    const proibidos = [
      "bairrosAtendidos",
      "bairros_atendidos",
      "service_area",
      "MESMO_BAIRRO",
      "BAIRROS_POR_CIDADE",
      "bairrosDe",
      "MAX_BAIRROS_ATENDIDOS",
      "CampoBairro",
      "noSeuBairro",
    ];

    const achados = TODOS.flatMap((a) =>
      proibidos
        .filter((p) => a.codigo.includes(p))
        .map((p) => `${a.caminho}: ${p}`),
    );

    expect(achados).toEqual([]);
  });

  it("nenhum formulário de pessoa tem campo de bairro", () => {
    for (const caminho of [
      "app/(auth)/cadastro/form.tsx",
      "app/(app)/perfil/editar/form.tsx",
      "app/(app)/perfil/virar-prestador/form.tsx",
    ]) {
      const fonte = TODOS.find((a) => a.caminho === caminho)?.codigo;

      expect(fonte, `${caminho} existe`).toBeTruthy();
      expect(fonte, `${caminho} pede bairro`).not.toMatch(PALAVRA);
    }
  });

  /*
   * A vaga é o único formulário com o campo, e ele é opcional: a empresa
   * que não quer escrever bairro não é barrada, e o servidor aceita vazio.
   */
  it("a vaga mantém o bairro, como texto livre e opcional", () => {
    const form = TODOS.find((a) =>
      a.caminho.endsWith("_contratacao/nova-vaga-form.tsx"),
    )?.codigo;

    expect(form).toContain('name="bairro"');
    expect(form).not.toMatch(/name="bairro"[^>]*required/);
  });
});
