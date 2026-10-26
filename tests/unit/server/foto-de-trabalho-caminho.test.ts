/**
 * @vitest-environment node
 *
 * O caminho no bucket de uma foto de trabalho, a partir do endereço que o
 * banco guarda (#452). É ele que decide qual arquivo some quando o admin
 * tira uma foto do ar: apagar o arquivo de outra pessoa, ou um fora da
 * pasta das fotos, é pior do que deixar um órfão no bucket.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/service", () => ({
  temChaveDeServico: false,
  clienteDeServico: () => null,
}));

import { caminhoDaFotoDeTrabalho } from "@/server/arquivos/servico";

const BASE = "https://projeto.supabase.co";
const AUTOR = "66666666-6666-4666-8666-000000000001";
const OUTRO = "88888888-8888-4888-8888-000000000001";
const NOME = "77777777-7777-4777-8777-000000000001";
const PUBLICO = `${BASE}/storage/v1/object/public`;

describe("caminhoDaFotoDeTrabalho", () => {
  it("devolve o caminho da foto do próprio autor, sem o ?v=", () => {
    expect(
      caminhoDaFotoDeTrabalho(
        BASE,
        AUTOR,
        `${PUBLICO}/portfolio/trabalho/${AUTOR}/${NOME}.webp?v=123`,
      ),
    ).toBe(`trabalho/${AUTOR}/${NOME}.webp`);
  });

  it.each([
    [
      "pasta de outra pessoa",
      `${PUBLICO}/portfolio/trabalho/${OUTRO}/${NOME}.webp`,
    ],
    [
      "volta de pasta para a de outra pessoa",
      `${PUBLICO}/portfolio/trabalho/${AUTOR}/../${OUTRO}/${NOME}.webp`,
    ],
    [
      "volta de pasta codificada",
      `${PUBLICO}/portfolio/trabalho/${AUTOR}/%2e%2e/${OUTRO}/${NOME}.webp`,
    ],
    ["outro bucket", `${PUBLICO}/avatares/trabalho/${AUTOR}/${NOME}.webp`],
    [
      "outro projeto",
      `https://outro.supabase.co/storage/v1/object/public/portfolio/trabalho/${AUTOR}/${NOME}.webp`,
    ],
    [
      "bucket privado",
      `${BASE}/storage/v1/object/sign/portfolio/trabalho/${AUTOR}/${NOME}.webp`,
    ],
    [
      "nome que não foi sorteado aqui",
      `${PUBLICO}/portfolio/trabalho/${AUTOR}/foto.webp`,
    ],
    ["extensão estranha", `${PUBLICO}/portfolio/trabalho/${AUTOR}/${NOME}.svg`],
    ["pasta a mais", `${PUBLICO}/portfolio/trabalho/${AUTOR}/x/${NOME}.webp`],
    ["não é URL", "trabalho/foto.webp"],
  ])("recusa %s", (_nome, url) => {
    expect(caminhoDaFotoDeTrabalho(BASE, AUTOR, url)).toBeNull();
  });

  it("sem a URL do projeto configurada, não apaga nada", () => {
    expect(
      caminhoDaFotoDeTrabalho(
        undefined,
        AUTOR,
        `${PUBLICO}/portfolio/trabalho/${AUTOR}/${NOME}.webp`,
      ),
    ).toBeNull();
  });
});
