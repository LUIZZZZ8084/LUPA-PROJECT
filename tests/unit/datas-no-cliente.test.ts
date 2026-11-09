/**
 * @vitest-environment node
 *
 * Componente cliente renderiza duas vezes: no servidor da Vercel, em UTC,
 * e no navegador, no fuso de quem abre. Data ou hora formatada sem
 * `timeZone` sai diferente nas duas, e o React descarta o HTML do servidor
 * e refaz a árvore no cliente. Foi o que o painel do admin fez em toda
 * abertura por quase um mês, com o horário de apuração (#598) — e nada
 * ficou vermelho, só um evento no Sentry.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) return arquivos(caminho);
    return /\.tsx?$/.test(nome) ? [caminho] : [];
  });
}

const FORMATA_DATA = /toLocale(?:Date|Time)String\(|Intl\.DateTimeFormat\(/g;

/** As chamadas que formatam data, cada uma com o trecho até fechar. */
function chamadas(fonte: string): string[] {
  return [...fonte.matchAll(FORMATA_DATA)].map((m) => {
    const inicio = m.index ?? 0;
    let profundidade = 0;
    for (let i = inicio + m[0].length - 1; i < fonte.length; i++) {
      if (fonte[i] === "(") profundidade++;
      if (fonte[i] === ")" && --profundidade === 0) {
        return fonte.slice(inicio, i + 1);
      }
    }
    return fonte.slice(inicio);
  });
}

describe("data formatada em componente cliente", () => {
  const clientes = ["src/app", "src/components"]
    .flatMap(arquivos)
    .filter((f) => /^\s*["']use client["']/.test(readFileSync(f, "utf8")));

  it("a varredura encontra componentes cliente que formatam data", () => {
    const comData = clientes.filter(
      (f) => chamadas(readFileSync(f, "utf8")).length > 0,
    );
    expect(comData.length).toBeGreaterThan(0);
  });

  it("sempre fixa o fuso, para o servidor e o navegador escreverem igual", () => {
    const semFuso = clientes.flatMap((f) =>
      chamadas(readFileSync(f, "utf8"))
        .filter((c) => !c.includes("timeZone"))
        .map((c) => `${f}: ${c.split("\n")[0]}`),
    );
    expect(semFuso).toEqual([]);
  });

  it("reconhece a chamada sem fuso que causou o #598", () => {
    const antes = `{new Date(x).toLocaleTimeString("pt-BR")}`;
    expect(chamadas(antes).filter((c) => !c.includes("timeZone"))).toHaveLength(
      1,
    );
  });
});
