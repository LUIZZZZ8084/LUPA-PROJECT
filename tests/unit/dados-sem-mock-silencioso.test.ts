/**
 * @vitest-environment node
 *
 * Com o Supabase ligado, `src/lib/data.ts` não pode servir dado de exemplo.
 *
 * O padrão antigo era `if (!error && data) return data`, e o que vinha
 * depois era o mock. Qualquer falha — chave errada, rede, view ausente —
 * virava silêncio: a tela renderizava dado falso, sem log e sem o aviso de
 * demonstração. Uma integração quebrada ficou invisível por uma hora assim.
 *
 * Pior: a mesma queda acontecia quando o banco simplesmente não encontrava
 * o registro. `/servicos/prv-joao-silva` — id que só existe no mock —
 * respondia HTTP 200 com perfil completo em produção, com botão de contato
 * apontando para um número que podia ser de alguém em Sinop.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const FONTE = readFileSync(join(process.cwd(), "src/lib/data.ts"), "utf8");

/**
 * Sem comentários: o texto que descreve o padrão antigo não pode fazer o
 * teste passar nem falhar. O que se verifica é código.
 */
const DATA = FONTE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
const MOCK = readFileSync(join(process.cwd(), "src/lib/mock-data.ts"), "utf8");

describe("data.ts não engole erro do banco", () => {
  /**
   * Este é o padrão exato que causou o problema. Se voltar, o teste cai.
   */
  it("não sobrou nenhum `if (!error && data)`", () => {
    const ocorrencias = DATA.match(/if\s*\(!error\s*&&\s*data\)/g) ?? [];
    expect(ocorrencias).toEqual([]);
  });

  it("toda consulta que desestrutura `error` o trata", () => {
    const consultas = (DATA.match(/const \{ data, error \}/g) ?? []).length;
    const tratamentos = (DATA.match(/if \(error\)/g) ?? []).length;

    expect(consultas).toBeGreaterThan(0);
    expect(tratamentos, "consulta sem tratamento de erro").toBe(consultas);
  });

  /**
   * O invariante é "todo erro é olhado e termina em exceção". A forma exata
   * não é literal: buscas por id desviam 22P02 — id sem forma de uuid —
   * para não-encontrado antes de lançar.
   */
  it("nenhum erro é apenas ignorado", () => {
    const lancamentos = (DATA.match(/throw falhaDeConsulta/g) ?? []).length;
    const consultas = (DATA.match(/const \{ data, error \}/g) ?? []).length;

    expect(lancamentos).toBe(consultas);
  });

  it("a exceção diz qual origem falhou", () => {
    expect(DATA).toMatch(/function falhaDeConsulta\(/);
    expect(DATA).toContain("Consulta a");
  });
});

describe("os telefones de exemplo não alcançam ninguém", () => {
  const TELEFONES = [...new Set(MOCK.match(/phone: "(\d{10,13})"/g) ?? [])].map(
    (t) => t.replace(/\D/g, ""),
  );

  it("o mock traz telefones — senão o teste não prova nada", () => {
    expect(TELEFONES.length).toBeGreaterThan(0);
  });

  /**
   * Em demonstração `resolveContact` redireciona, então estes números não
   * eram discados. Mas o fallback os servia com o banco ligado, e aí o
   * botão montava `wa.me` com eles.
   */
  it.each(TELEFONES)("%s não é discável", (tel) => {
    expect(tel.slice(2).startsWith("0"), `${tel} pode ser de alguém`).toBe(
      true,
    );
  });

  it("nenhum parece celular brasileiro de verdade", () => {
    expect(TELEFONES.filter((t) => /^\d{2}9\d{8}$/.test(t))).toEqual([]);
  });
});
