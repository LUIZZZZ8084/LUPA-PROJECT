/**
 * @vitest-environment node
 *
 * As varreduras agendadas na Vercel (#565).
 *
 * O que se prova: toda rota em `src/app/api/cron` tem um agendamento em
 * `schedules`, chamado por GET — que é o único método que as rotas
 * exportam, e o Schedules usa POST se ninguém disser nada —, e o formato
 * antigo `crons` não volta: com os dois no arquivo, cada varredura roda
 * duas vezes, e a de aviso manda e-mail duas vezes.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = process.cwd();
const PASTA_DOS_CRONS = join(RAIZ, "src/app/api/cron");

interface Agendamento {
  schedule: string;
  path?: string;
  requestMethod?: string;
}

const config = JSON.parse(readFileSync(join(RAIZ, "vercel.json"), "utf8")) as {
  crons?: unknown;
  schedules?: Record<string, Agendamento>;
};

const rotasDeCron = readdirSync(PASTA_DOS_CRONS).filter((nome) =>
  statSync(join(PASTA_DOS_CRONS, nome)).isDirectory(),
);

describe("agendamentos da Vercel", () => {
  it("o formato antigo `crons` não volta", () => {
    expect(config.crons).toBeUndefined();
  });

  it("há rotas de cron para conferir", () => {
    expect(rotasDeCron.length).toBeGreaterThan(0);
  });

  it.each(rotasDeCron)("/api/cron/%s tem agendamento, por GET", (rota) => {
    const caminho = `/api/cron/${rota}`;
    const agendamentos = Object.values(config.schedules ?? {}).filter(
      (a) => a.path === caminho,
    );

    expect(agendamentos, caminho).toHaveLength(1);
    expect(agendamentos[0].requestMethod).toBe("GET");

    const fonte = readFileSync(join(PASTA_DOS_CRONS, rota, "route.ts"), "utf8");
    expect(fonte).toMatch(/export async function GET\(/);
  });

  it("nenhum agendamento aponta para rota que não existe", () => {
    for (const a of Object.values(config.schedules ?? {})) {
      expect(rotasDeCron.map((r) => `/api/cron/${r}`)).toContain(a.path);
    }
  });

  /**
   * Uma vez por dia, em hora e minuto fixos. O plano grátis aceita até de
   * 15 em 15 minutos, mas as duas varreduras são diárias de propósito: a de
   * aviso manda um e-mail por empresa por dia, e a de pagamentos é a rede
   * de proteção do webhook, não o caminho normal.
   */
  it("cada varredura roda uma vez por dia", () => {
    for (const [nome, a] of Object.entries(config.schedules ?? {})) {
      expect(a.schedule, nome).toMatch(/^\d{1,2} \d{1,2} \* \* \*$/);
    }
  });
});
