/**
 * @vitest-environment node
 *
 * As listas de áreas de vaga e de profissões de prestador (#457).
 *
 * `JOB_CATEGORIES` é só uma constante: a categoria gravada numa vaga é o
 * próprio texto. `SERVICE_CATEGORIES` é diferente — cada id é a chave de
 * `perfis_prestador.categoria_id`, e a constante, o `schema.sql` e o script
 * de produção precisam dizer exatamente a mesma coisa. Divergir não quebra
 * nada na hora: a profissão aparece na tela e falha por chave estrangeira
 * quando alguém a escolhe.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { JOB_CATEGORIES, SERVICE_CATEGORIES } from "@/lib/constants";

const lerSql = (arquivo: string) =>
  readFileSync(join(process.cwd(), "supabase", arquivo), "utf8");

/** As linhas `(id, 'slug', 'nome')` de um `insert into categorias_servico`. */
function linhasDeCategorias(sql: string) {
  const inicio = sql.indexOf("insert into categorias_servico");
  expect(inicio, "insert não encontrado").toBeGreaterThanOrEqual(0);
  const bloco = sql.slice(inicio, sql.indexOf(";", inicio));
  return [...bloco.matchAll(/\(\s*(\d+)\s*,\s*'([^']+)'\s*,\s*'([^']+)'\s*\)/g)]
    .map((m) => ({ id: Number(m[1]), slug: m[2], name: m[3] }))
    .sort((a, b) => a.id - b.id);
}

describe("profissões de prestador", () => {
  const daConstante = [...SERVICE_CATEGORIES].sort((a, b) => a.id - b.id);

  it("o schema.sql tem as mesmas, com os mesmos ids", () => {
    expect(linhasDeCategorias(lerSql("schema.sql"))).toEqual(daConstante);
  });

  it("o script de produção cobre exatamente as que o schema acrescentou depois das dezessete", () => {
    const depoisDasDezessete = daConstante.filter((c) => c.id > 17);
    expect(linhasDeCategorias(lerSql("aplica-mais-profissoes.sql"))).toEqual(
      depoisDasDezessete,
    );
  });

  it("ids seguidos, sem buraco nem repetição", () => {
    expect(daConstante.map((c) => c.id)).toEqual(
      daConstante.map((_, i) => i + 1),
    );
  });

  it("slug e nome não se repetem — o banco recusaria", () => {
    const slugs = daConstante.map((c) => c.slug);
    const nomes = daConstante.map((c) => c.name.toLowerCase());
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(new Set(nomes).size).toBe(nomes.length);
  });

  it("slug é só letra minúscula, número e hífen: vai na URL", () => {
    for (const { slug } of daConstante) {
      expect(slug, slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  /** O que já existia não muda de id nem de nome: perfis apontam para eles. */
  it("as dezessete originais continuam como eram", () => {
    expect(daConstante.slice(0, 3)).toEqual([
      { id: 1, slug: "eletricista", name: "Eletricista" },
      { id: 2, slug: "diarista", name: "Diarista" },
      { id: 3, slug: "pintor", name: "Pintor" },
    ]);
    expect(daConstante[16]).toEqual({
      id: 17,
      slug: "mecanico",
      name: "Mecânico(a)",
    });
  });
});

describe("áreas de vaga", () => {
  it("não se repetem, nem ignorando caixa", () => {
    const nomes = JOB_CATEGORIES.map((c) => c.toLowerCase());
    expect(new Set(nomes).size).toBe(nomes.length);
  });

  it("nenhuma é vazia nem tem espaço sobrando", () => {
    for (const area of JOB_CATEGORIES) {
      expect(area, area).toBe(area.trim());
      expect(area.length, area).toBeGreaterThan(2);
    }
  });

  /**
   * A área gravada numa vaga é o próprio texto: renomear ou tirar uma das
   * antigas esconderia, da busca por categoria, o que já foi publicado.
   */
  it("as vinte e uma originais continuam, na mesma ordem", () => {
    expect(JOB_CATEGORIES.slice(0, 5)).toEqual([
      "Agronegócio",
      "Comércio e Vendas",
      "Administrativo",
      "Construção Civil",
      "Logística e Transporte",
    ]);
    expect(JOB_CATEGORIES[20]).toBe("Frigorífico e Agroindústria");
  });
});
