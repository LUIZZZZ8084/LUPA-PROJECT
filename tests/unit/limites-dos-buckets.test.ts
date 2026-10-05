/**
 * @vitest-environment node
 *
 * O limite dos buckets é o mesmo da aplicação (#332).
 *
 * Três lugares dizem o mesmo número: `REGRAS`, o `storage.sql` de banco
 * novo e o script que aplica no banco que já existe. Número repetido em
 * três arquivos é o que diverge na primeira mudança — a lição da senha
 * (#290) —, e aqui divergir tem um sintoma ruim: o bucket recusando um
 * arquivo que a tela prometeu aceitar, com um erro que não é nosso.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { REGRAS } from "@/server/arquivos/regras";

const SUPABASE = join(process.cwd(), "supabase");

interface Limite {
  bytes: number;
  tipos: string[];
}

const tipos = (lista: string) =>
  [...lista.matchAll(/'([^']+)'/g)].map((m) => m[1]);

/** `('avatares', 'avatares', true, 2097152, array['image/webp', …])` */
function doStorageSql(): Map<string, Limite> {
  const fonte = readFileSync(join(SUPABASE, "storage.sql"), "utf8");
  const linhas = fonte.matchAll(
    /\('(\w+)',\s*'\w+',\s*(?:true|false),\s*(\d+),\s*array\[([^\]]*)\]\)/g,
  );
  return new Map(
    [...linhas].map((m) => [m[1], { bytes: Number(m[2]), tipos: tipos(m[3]) }]),
  );
}

/** `set file_size_limit = N, allowed_mime_types = array[…] where id …` */
function doScript(): Map<string, Limite> {
  const fonte = readFileSync(
    join(SUPABASE, "aplica-limites-dos-buckets.sql"),
    "utf8",
  );
  const mapa = new Map<string, Limite>();
  for (const m of fonte.matchAll(
    /file_size_limit = (\d+),\s*allowed_mime_types = array\[([^\]]*)\]\s*where id (?:=|in) \(?([^;)]*)\)?;/g,
  )) {
    for (const balde of tipos(m[3])) {
      mapa.set(balde, { bytes: Number(m[1]), tipos: tipos(m[2]) });
    }
  }
  return mapa;
}

/** O maior limite de cada bucket, e os tipos que a aplicação grava nele. */
function daAplicacao(): Map<string, Limite> {
  const mapa = new Map<string, Limite>();
  for (const regra of Object.values(REGRAS)) {
    const atual = mapa.get(regra.balde);
    // Imagem é gravada reduzida, em WebP (#283); PDF passa como veio.
    const gravados = regra.tiposAceitos.some((t) => t.startsWith("image/"))
      ? ["image/webp"]
      : [...regra.tiposAceitos];
    mapa.set(regra.balde, {
      bytes: Math.max(atual?.bytes ?? 0, regra.limiteBytes),
      tipos: [...new Set([...(atual?.tipos ?? []), ...gravados])],
    });
  }
  return mapa;
}

describe("limites dos buckets", () => {
  const storage = doStorageSql();
  const script = doScript();
  const app = daAplicacao();

  it("as duas leituras acham os quatro buckets", () => {
    // Controle: se o padrão parar de casar, os testes abaixo passariam vazios.
    expect([...storage.keys()].sort()).toEqual([
      "avatares",
      "curriculos",
      "portfolio",
      "verificacao",
    ]);
    expect([...script.keys()].sort()).toEqual([...storage.keys()].sort());
  });

  it("banco novo e banco existente recebem o mesmo limite", () => {
    expect(Object.fromEntries(script)).toEqual(Object.fromEntries(storage));
  });

  it.each([...daAplicacao().keys()])(
    "%s aceita, no bucket, o que a aplicação grava nele",
    (balde) => {
      const regra = app.get(balde) as Limite;
      const bucket = storage.get(balde) as Limite;

      expect(bucket.bytes).toBe(regra.bytes);
      for (const tipo of regra.tipos) expect(bucket.tipos).toContain(tipo);
    },
  );
});
