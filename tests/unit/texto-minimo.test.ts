/**
 * Nenhum texto que informa tem menos de 12 px (#481).
 *
 * Chips e linha de detalhes dos cartões (local, contrato, "há 2h"), selos,
 * rótulos da navegação inferior (10 px), descrições do bloco de confiança da
 * home: tudo isso estava em 10 ou 11 px. Quem lê o app na rua, sob sol e com o
 * celular na mão, é quem mais perde com letra pequena, e justamente em local,
 * salário e prazo, que decidem se a pessoa abre a vaga. O piso passou a ser
 * 12 px (`text-xs`).
 *
 * É uma trava de código, e não de tela, porque o tamanho nasce nas classes: um
 * `text-[11px]` novo é o jeito de a letra pequena voltar, e é isso que se
 * procura. Quem precisar de uma exceção a registra aqui, com o motivo, e o
 * teste cobra que a exceção ainda faça sentido.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = process.cwd();
const PISO_EM_PX = 12;

/** Tamanhos escritos como `text-[11px]`, `text-[10.5px]`, `text-[9px]`. */
const TAMANHO = /text-\[(\d+(?:\.\d+)?)px\]/g;

type Excecao = { onde: string; motivo: string };

const EXCECOES: Excecao[] = [
  {
    onde: "src/app/(app)/admin/",
    motivo:
      "painel interno do Luiz, denso de propósito: quem o usa é quem o mantém, no desktop",
  },
  {
    onde: "src/components/ui/avatar.tsx",
    motivo:
      "iniciais dentro do círculo de 36 px: decoração, e o nome da pessoa está ao lado",
  },
];

function arquivosDe(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) return arquivosDe(caminho);
    return /\.(tsx?|css)$/.test(nome) ? [caminho] : [];
  });
}

const todos = arquivosDe(join(RAIZ, "src")).map((caminho) => ({
  caminho: relative(RAIZ, caminho).replaceAll("\\", "/"),
  texto: readFileSync(caminho, "utf8"),
}));

const naExcecao = (caminho: string) =>
  EXCECOES.some((e) => caminho.startsWith(e.onde));

/** Cada uso de um tamanho abaixo do piso: arquivo, tamanho, linha. */
function usosPequenos(arquivos: typeof todos) {
  const achados: string[] = [];
  for (const { caminho, texto } of arquivos) {
    texto.split("\n").forEach((linha, i) => {
      for (const m of linha.matchAll(TAMANHO)) {
        if (Number(m[1]) < PISO_EM_PX) {
          achados.push(`${caminho}:${i + 1}  text-[${m[1]}px]`);
        }
      }
    });
  }
  return achados;
}

describe("piso de 12 px para o texto", () => {
  it("nenhum arquivo fora das exceções tem texto abaixo de 12 px", () => {
    const fora = todos.filter((a) => !naExcecao(a.caminho));

    expect(usosPequenos(fora)).toEqual([]);
  });

  it("a navegação inferior usa 12 px nos rótulos (eram 10)", () => {
    const nav = todos.find(
      (a) => a.caminho === "src/components/layout/bottom-nav.tsx",
    );

    expect(nav?.texto).toContain("text-xs font-medium");
    expect(nav?.texto).not.toMatch(/text-\[10px\]/);
  });

  it("as descrições do bloco de confiança da home têm 13 px, e a frase final 14", () => {
    const home = todos.find(
      (a) => a.caminho === "src/app/(app)/(inicio)/page.tsx",
    );

    expect(home?.texto).toContain(
      'className="mt-1 text-[13px] leading-snug text-muted">{description}',
    );
    expect(home?.texto).toMatch(
      /border-t border-line pt-4 text-sm leading-relaxed text-muted/,
    );
  });

  it("o selo e o chip de verificação também respeitam o piso", () => {
    for (const caminho of [
      "src/components/ui/badge.tsx",
      "src/components/verified-badge.tsx",
    ]) {
      const arquivo = todos.find((a) => a.caminho === caminho);
      expect(arquivo?.texto, caminho).not.toMatch(/text-\[1[01]px\]/);
    }
  });
});

describe("as exceções continuam fazendo sentido", () => {
  for (const { onde, motivo } of EXCECOES) {
    it(`${onde}: ainda tem texto abaixo do piso (${motivo})`, () => {
      const dentro = todos.filter((a) => a.caminho.startsWith(onde));

      // Exceção sem uso é exceção velha: o código mudou e ela ficou para trás.
      expect(dentro.length).toBeGreaterThan(0);
      expect(usosPequenos(dentro).length).toBeGreaterThan(0);
    });
  }
});
