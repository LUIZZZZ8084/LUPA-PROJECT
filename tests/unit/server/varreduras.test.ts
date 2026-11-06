/**
 * @vitest-environment node
 *
 * O registro das varreduras (#566).
 *
 * O que se prova: a varredura que rodou grava o resumo; a que falhou grava o
 * erro sem apagar quando foi o último sucesso; o 503 de segredo ausente
 * grava, e o 401 de quem bate sem o segredo não; atrasada é sem sucesso há
 * mais de 26 horas; e falhar ao gravar não muda a resposta da varredura.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { executarVarredura } from "@/app/api/cron/executar";
import { erros } from "@/server/errors";
import {
  RepositorioVarredurasMemoria,
  usarRepositorioVarreduras,
} from "@/server/varreduras";
import {
  type ExecucaoDeVarredura,
  situacaoDasVarreduras,
} from "@/server/varreduras/tipos";

const HORA = 60 * 60 * 1000;
const AGORA = new Date("2026-11-06T13:00:00.000Z");
const antes = (horas: number) =>
  new Date(AGORA.getTime() - horas * HORA).toISOString();

describe("situação das varreduras", () => {
  const execucao = (
    mudanca: Partial<ExecucaoDeVarredura>,
  ): ExecucaoDeVarredura => ({
    nome: "avisar-vagas-vencendo",
    rodouEm: antes(1),
    ok: true,
    resumo: {},
    ultimaOkEm: antes(1),
    ...mudanca,
  });

  it("devolve as duas varreduras, na ordem, mesmo sem registro", () => {
    const s = situacaoDasVarreduras([], AGORA);
    expect(s.map((v) => v.nome)).toEqual([
      "reconciliar-pagamentos",
      "avisar-vagas-vencendo",
    ]);
    // Sem registro é a que ainda não rodou depois do deploy, não atrasada.
    expect(s.every((v) => v.ultima === null && !v.atrasada)).toBe(true);
  });

  it("sucesso há 25 horas está em dia; há 27, atrasada", () => {
    expect(
      situacaoDasVarreduras([execucao({ ultimaOkEm: antes(25) })], AGORA)[1]
        .atrasada,
    ).toBe(false);
    expect(
      situacaoDasVarreduras([execucao({ ultimaOkEm: antes(27) })], AGORA)[1]
        .atrasada,
    ).toBe(true);
  });

  it("registro só de falha, sem sucesso nunca, é atrasada", () => {
    const [, aviso] = situacaoDasVarreduras(
      [execucao({ ok: false, ultimaOkEm: null })],
      AGORA,
    );
    expect(aviso.atrasada).toBe(true);
  });

  it("a falha de hoje não apaga quando foi o último sucesso", async () => {
    const repo = new RepositorioVarredurasMemoria();
    await repo.registrar("reconciliar-pagamentos", {
      ok: true,
      resumo: { vistas: 2, reconciliadas: 1 },
      em: antes(24),
    });
    await repo.registrar("reconciliar-pagamentos", {
      ok: false,
      resumo: { erro: "indisponivel" },
      em: antes(0),
    });
    const [linha] = await repo.todas();
    expect(linha).toMatchObject({
      ok: false,
      resumo: { erro: "indisponivel" },
      ultimaOkEm: antes(24),
    });
  });
});

describe("executarVarredura", () => {
  let repo: RepositorioVarredurasMemoria;
  let restaurar: () => void;

  beforeEach(() => {
    repo = new RepositorioVarredurasMemoria();
    restaurar = usarRepositorioVarreduras(repo);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("CRON_SECRET", "segredo-do-cron");
  });

  afterEach(() => {
    restaurar();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  const pedido = (authorization?: string) =>
    new Request("http://localhost/api/cron/avisar-vagas-vencendo", {
      headers: authorization ? { authorization } : {},
    });

  const rodar = (
    request: Request,
    trabalho: () => Promise<object> = async () => ({
      vagasVencendo: 3,
      empresasAvisadas: 1,
    }),
  ) =>
    executarVarredura(request, {
      nome: "avisar-vagas-vencendo",
      acao: "vagas.aviso_vencimento",
      concluida: "aviso concluído",
      rodar: trabalho,
    });

  it("com o segredo, roda, responde o resumo e grava o sucesso", async () => {
    const r = await rodar(pedido("Bearer segredo-do-cron"));

    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ vagasVencendo: 3, empresasAvisadas: 1 });
    const [linha] = await repo.todas();
    expect(linha).toMatchObject({
      nome: "avisar-vagas-vencendo",
      ok: true,
      resumo: { vagasVencendo: 3, empresasAvisadas: 1 },
    });
    expect(linha.ultimaOkEm).toBe(linha.rodouEm);
  });

  it("sem o segredo certo, recusa e não grava nada", async () => {
    const trabalho = vi.fn();
    expect((await rodar(pedido("Bearer outro"), trabalho)).status).toBe(401);
    expect((await rodar(pedido(), trabalho)).status).toBe(401);
    expect(trabalho).not.toHaveBeenCalled();
    expect(await repo.todas()).toEqual([]);
  });

  it("na Vercel sem segredo configurado, recusa e grava a falha", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const r = await rodar(pedido());

    expect(r.status).toBe(503);
    const [linha] = await repo.todas();
    expect(linha).toMatchObject({
      ok: false,
      resumo: { erro: "CRON_SECRET ausente" },
      ultimaOkEm: null,
    });
  });

  it("o trabalho que quebra grava o código do erro", async () => {
    const r = await rodar(pedido("Bearer segredo-do-cron"), async () => {
      throw erros.indisponivel("banco fora");
    });

    expect(r.status).toBeGreaterThanOrEqual(500);
    const [linha] = await repo.todas();
    expect(linha).toMatchObject({
      ok: false,
      resumo: { erro: "indisponivel" },
    });
  });

  it("falhar ao gravar não muda a resposta da varredura", async () => {
    vi.spyOn(repo, "registrar").mockRejectedValue(new Error("sem banco"));
    const r = await rodar(pedido("Bearer segredo-do-cron"));
    expect(r.status).toBe(200);
  });
});
