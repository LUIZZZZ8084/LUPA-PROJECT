/**
 * @vitest-environment node
 *
 * O aviso de vaga vencendo (#561), e quem pode disparar a varredura.
 *
 * O que se prova: um e-mail por empresa, com as vagas dela que vencem em até
 * três dias; a vaga avisada não volta no dia seguinte, e a reativada (prazo
 * novo) volta; encerrada, vencida, distante, sem e-mail confirmado ou sem
 * conta não geram aviso; e a rota do cron tem o mesmo portão da varredura de
 * pagamentos.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const enviados = vi.hoisted(
  () => [] as { para: string; assunto: string; corpo: string; tipo: string }[],
);
const usuarios = vi.hoisted(
  () =>
    new Map<
      string,
      {
        id: string;
        email: string;
        nomeCompleto: string;
        papel: string;
        emailVerificado: boolean;
      }
    >(),
);

vi.mock("@/server/email", () => ({
  enviarEmail: async (email: (typeof enviados)[number]) => {
    enviados.push(email);
    return { ok: true };
  },
}));
vi.mock("@/server/repositories", () => ({
  repositorioUsuarios: () => ({
    porId: async (id: string) => usuarios.get(id) ?? null,
  }),
}));
vi.mock("@/server/url-publica", () => ({
  urlPublica: () => "https://lupapp.com.br",
}));

import { GET } from "@/app/api/cron/avisar-vagas-vencendo/route";
import { limparLimites } from "@/server/auth/rate-limit";
import { RepositorioVagasMemoria, usarRepositorioVagas } from "@/server/vagas";
import { avisarVagasVencendo } from "@/server/vagas/aviso-de-vencimento";
import type { Vaga } from "@/server/vagas/tipos";

const AGORA = new Date("2026-11-05T12:00:00.000Z");
const emDias = (d: number) =>
  new Date(AGORA.getTime() + d * 24 * 60 * 60 * 1000).toISOString();

const vaga = (
  id: string,
  empresaId: string,
  expiraEm: string,
  mudanca: Partial<Vaga> = {},
): Vaga => ({
  id,
  empresaId,
  titulo: `Vaga ${id}`,
  descricao: "Descrição.",
  categoria: null,
  cidade: "Sinop - MT",
  bairro: null,
  endereco: null,
  tipoContrato: null,
  modalidade: null,
  paraPcd: false,
  contratanteConfidencial: null,
  salarioMin: null,
  salarioMax: null,
  habilidades: [],
  perguntas: [],
  status: "aberta",
  criadoEm: "2026-10-08T12:00:00.000Z",
  expiraEm,
  ...mudanca,
});

describe("aviso de vaga vencendo", () => {
  let vagas: RepositorioVagasMemoria;
  let restaurar: () => void;

  beforeEach(() => {
    enviados.length = 0;
    usuarios.clear();
    limparLimites();
    for (const [id, papel, ok] of [
      ["emp-1", "empresa", true],
      ["prs-1", "prestador_servico", true],
      ["emp-sem", "empresa", false],
    ] as const) {
      usuarios.set(id, {
        id,
        email: `${id}@exemplo.com`,
        nomeCompleto: "Agro Norte",
        papel,
        emailVerificado: ok,
      });
    }
    vagas = new RepositorioVagasMemoria();
    vagas.semear([
      vaga("v1", "emp-1", emDias(1)),
      vaga("v2", "emp-1", emDias(2.5)),
      vaga("longe", "emp-1", emDias(10)),
      vaga("vencida", "emp-1", emDias(-1)),
      vaga("fechada", "emp-1", emDias(1), { status: "fechada" }),
      vaga("p1", "prs-1", emDias(2)),
      vaga("s1", "emp-sem", emDias(1)),
      vaga("x1", "empresa-de-exemplo", emDias(1)),
    ]);
    restaurar = usarRepositorioVagas(vagas);
  });

  afterEach(() => restaurar());

  it("um e-mail por empresa, com as vagas que vencem em até três dias", async () => {
    const r = await avisarVagasVencendo(AGORA);

    expect(r.empresasAvisadas).toBe(2);
    const daEmpresa = enviados.find((e) => e.para === "emp-1@exemplo.com");
    expect(daEmpresa?.tipo).toBe("aviso_vencimento");
    expect(daEmpresa?.assunto).toBe("2 vagas suas vão vencer");
    expect(daEmpresa?.corpo).toContain("- Vaga v1: vence");
    expect(daEmpresa?.corpo).toContain("- Vaga v2: vence");
    expect(daEmpresa?.corpo).not.toContain("longe");
    expect(daEmpresa?.corpo).not.toContain("fechada");
    expect(daEmpresa?.corpo).not.toContain("vencida");
    expect(daEmpresa?.corpo).toContain("https://lupapp.com.br/empresa/vagas");
  });

  it("o prestador recebe o link da área dele, e uma vaga só no assunto", async () => {
    await avisarVagasVencendo(AGORA);
    const doPrestador = enviados.find((e) => e.para === "prs-1@exemplo.com");
    expect(doPrestador?.assunto).toBe("Sua vaga de Vaga p1 vai vencer");
    expect(doPrestador?.corpo).toContain(
      "https://lupapp.com.br/contratar/vagas",
    );
  });

  it("sem e-mail confirmado, ou sem conta, não sai", async () => {
    await avisarVagasVencendo(AGORA);
    expect(enviados.map((e) => e.para)).not.toContain("emp-sem@exemplo.com");
    expect(enviados).toHaveLength(2);
  });

  it("a vaga avisada não volta no dia seguinte", async () => {
    await avisarVagasVencendo(AGORA);
    enviados.length = 0;

    await avisarVagasVencendo(new Date(AGORA.getTime() + 24 * 60 * 60 * 1000));
    expect(enviados).toHaveLength(0);
  });

  it("reativada, com prazo novo, entra de novo quando for vencer", async () => {
    await avisarVagasVencendo(AGORA);
    enviados.length = 0;

    // Reativou: o prazo andou 30 dias. Perto do novo fim, o aviso volta.
    await vagas.reativar("p1");
    const novoFim = new Date((await vagas.porId("p1"))?.expiraEm ?? "");
    await avisarVagasVencendo(
      new Date(novoFim.getTime() - 2 * 24 * 60 * 60 * 1000),
    );
    expect(enviados.map((e) => e.para)).toContain("prs-1@exemplo.com");
  });
});

describe("rota do cron do aviso de vencimento", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("CRON_SECRET", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  const chamar = (authorization?: string) =>
    GET(
      new Request("http://localhost/api/cron/avisar-vagas-vencendo", {
        headers: authorization ? { authorization } : {},
      }),
    );

  it("sem o segredo certo, recusa", async () => {
    vi.stubEnv("CRON_SECRET", "segredo-do-cron");
    expect((await chamar()).status).toBe(401);
    expect((await chamar("Bearer outro")).status).toBe(401);
  });

  it("na Vercel sem segredo configurado, recusa com 503", async () => {
    vi.stubEnv("VERCEL", "1");
    expect((await chamar()).status).toBe(503);
  });

  it("com o segredo certo, roda", async () => {
    vi.stubEnv("CRON_SECRET", "segredo-do-cron");
    const r = await chamar("Bearer segredo-do-cron");
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ empresasAvisadas: 0 });
  });
});
