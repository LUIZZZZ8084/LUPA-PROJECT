/**
 * @vitest-environment node
 *
 * Os campos de CNPJ deixam digitar letra (#297).
 *
 * Desde julho de 2026 a Receita emite CNPJ com letras, e o servidor já as
 * aceita. Mas `inputMode="numeric"` faz o teclado do celular oferecer só
 * números: o servidor aceitando e o campo não deixando digitar seria uma
 * empresa barrada por um detalhe que nenhum teste de servidor enxerga.
 *
 * Lê o código-fonte, no mesmo estilo de `cadastro-campos.test.ts`: o
 * comportamento do teclado não existe no jsdom.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const FORMULARIOS = [
  "src/app/(auth)/cadastro/form.tsx",
  "src/app/(app)/perfil/editar/form.tsx",
];

/** O elemento `<Input ... name="cnpj" ... />`, do `<Input` até o `/>`. */
function campoDeCnpj(fonte: string): string {
  const nome = fonte.indexOf('name="cnpj"');
  expect(nome, 'não achei name="cnpj"').toBeGreaterThan(-1);
  const inicio = fonte.lastIndexOf("<Input", nome);
  const fim = fonte.indexOf("/>", nome);
  return fonte.slice(inicio, fim + 2);
}

describe.each(FORMULARIOS)("%s", (arquivo) => {
  const campo = campoDeCnpj(
    readFileSync(join(process.cwd(), arquivo), "utf8").replace(/\r\n/g, "\n"),
  );

  it("o campo de CNPJ não força teclado numérico", () => {
    expect(campo).not.toContain('inputMode="numeric"');
    expect(campo).not.toContain('type="number"');
  });

  it("o teclado abre em maiúscula e sem corretor", () => {
    expect(campo).toContain('autoCapitalize="characters"');
    expect(campo).toContain('autoCorrect="off"');
    expect(campo).toContain("spellCheck={false}");
  });

  it("o campo não limita o que se pode digitar", () => {
    expect(campo).not.toMatch(/maxLength|pattern=/);
  });
});
