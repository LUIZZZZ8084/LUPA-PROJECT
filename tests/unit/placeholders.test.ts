/**
 * Placeholder que dá exemplo diz que é exemplo (#481).
 *
 * No formulário de publicar vaga, "Centro", "1800", "2200" e "colheitadeira,
 * CNH D…" tinham a cor de um valor digitado e nenhum "Ex.:" (os outros campos
 * do mesmo formulário já tinham). O cinza do placeholder é escuro de propósito,
 * para passar no contraste, e por isso mesmo uma palavra solta nele parece
 * campo já preenchido: a pessoa pula, ou acha que o app preencheu por ela.
 *
 * A regra, para todo `placeholder="..."` escrito no código:
 * - exemplo de conteúdo começa com "Ex.:";
 * - máscara de formato (telefone, CPF, CNPJ, "https://…", "voce@exemplo.com")
 *   se lê como formato e não como valor, e fica como está;
 * - pergunta ou instrução ("Buscar vaga…") termina em reticências.
 *
 * Só vale para o texto literal. Placeholder montado em código não é visto aqui.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = process.cwd();

function arquivosDe(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) return arquivosDe(caminho);
    return nome.endsWith(".tsx") ? [caminho] : [];
  });
}

type Achado = { onde: string; texto: string };

function placeholdersLiterais(): Achado[] {
  const achados: Achado[] = [];
  for (const caminho of arquivosDe(join(RAIZ, "src"))) {
    const linhas = readFileSync(caminho, "utf8").split("\n");
    linhas.forEach((linha, i) => {
      for (const m of linha.matchAll(/placeholder="([^"]*)"/g)) {
        achados.push({
          onde: `${relative(RAIZ, caminho).replaceAll("\\", "/")}:${i + 1}`,
          texto: m[1],
        });
      }
    });
  }
  return achados;
}

/**
 * Máscara: dígitos e pontuação ("(11) 99999-0000", "00.000.000/0000-00").
 * Precisa ter pontuação: "1800" e "150", só com dígitos, são justamente o
 * valor que parece digitado.
 */
const MASCARA = /^[\d()\-./#\sX]+$/;
const PONTUACAO = /[()\-./#X]/;

function seLeComoExemplo(texto: string) {
  return (
    texto.startsWith("Ex.: ") ||
    (MASCARA.test(texto) && PONTUACAO.test(texto)) ||
    texto.startsWith("https://") ||
    texto.includes("@exemplo.") ||
    texto.endsWith("…") ||
    texto.endsWith("...")
  );
}

describe("placeholders", () => {
  const todos = placeholdersLiterais();

  it("o código tem placeholders literais para conferir", () => {
    // Sem isto, um teste que varre zero arquivos passaria para sempre.
    expect(todos.length).toBeGreaterThan(30);
  });

  it("todo exemplo de conteúdo começa com 'Ex.:', e o resto é máscara ou instrução", () => {
    const parecemValor = todos
      .filter((p) => !seLeComoExemplo(p.texto))
      .map((p) => `${p.onde}  "${p.texto.slice(0, 50)}"`);

    expect(parecemValor).toEqual([]);
  });

  it("o formulário de publicar vaga, que motivou a regra, está inteiro", () => {
    const nova = todos.filter((p) =>
      p.onde.startsWith("src/app/(app)/_contratacao/nova-vaga-form.tsx"),
    );

    expect(nova.length).toBeGreaterThanOrEqual(6);
    for (const p of nova) expect(p.texto, p.onde).toMatch(/^Ex\.: /);
  });

  it("a regra pega o defeito: 'Centro' e '1800' soltos não passam", () => {
    for (const texto of [
      "Centro",
      "1800",
      "colheitadeira, CNH D",
      "Imediata",
    ]) {
      expect(seLeComoExemplo(texto), texto).toBe(false);
    }
    for (const texto of [
      "Ex.: Centro",
      "(11) 99999-0000",
      "000.000.000-00",
      "https://instagram.com/seunegocio",
      "voce@exemplo.com",
      "Buscar vaga…",
    ]) {
      expect(seLeComoExemplo(texto), texto).toBe(true);
    }
  });
});
