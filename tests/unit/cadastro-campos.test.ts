/**
 * @vitest-environment node
 *
 * Os nomes dos campos do formulário precisam ser os que o schema espera.
 *
 * O formulário enviava `name="role"` e o schema é uma união discriminada em
 * `papel`. Sem o discriminante, o Zod não descobre qual variante aplicar e
 * recusa tudo — a tela respondia "Revise os campos destacados" sem destacar
 * campo nenhum, porque o que faltava não estava na tela.
 *
 * Ninguém conseguia criar conta, e o defeito sobreviveu a uma inspeção
 * minha: vendo o mesmo erro em produção, culpei a ferramenta de teste em
 * vez de ler o formulário.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { schemaCadastro } from "@/server/auth/schemas";

const FORM = readFileSync(
  join(process.cwd(), "src/app/cadastro/form.tsx"),
  "utf8",
);

/** Todo `name="..."` do formulário. */
const NOMES = [
  ...new Set([...FORM.matchAll(/name="([a-zA-Z]+)"/g)].map((m) => m[1])),
];

/** Toda chave aceita por qualquer variante do schema. */
const ACEITAS = new Set(
  schemaCadastro.options.flatMap((variante) =>
    Object.keys(variante.shape as Record<string, unknown>),
  ),
);

describe("os campos do cadastro batem com o schema", () => {
  it("o formulário tem campos — senão o teste não prova nada", () => {
    expect(NOMES.length).toBeGreaterThan(5);
  });

  it.each(NOMES)('o campo "%s" existe no schema', (nome) => {
    expect(
      ACEITAS.has(nome),
      `"${nome}" não é aceito por nenhuma variante do schema`,
    ).toBe(true);
  });

  /**
   * O discriminante é o que escolhe a variante. Sem ele o Zod recusa antes
   * de olhar qualquer outro campo, e a mensagem não aponta para nada.
   */
  it("o discriminante `papel` é enviado", () => {
    expect(FORM).toContain('name="papel"');
    expect(FORM, "`role` era o nome errado").not.toContain('name="role"');
  });
});
