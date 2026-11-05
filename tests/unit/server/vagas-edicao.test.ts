/**
 * @vitest-environment node
 *
 * Editar a vaga publicada (#544).
 *
 * O que se prova: a dona corrige descrição, endereço, habilidades e salário;
 * outra empresa e o candidato não; o cargo, a cidade e o prazo não mudam nem
 * mandando pela action; com candidatura, o salário não diminui; e vaga fora
 * do ar não se edita. Os três papéis que publicam editam a própria.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: true }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => null,
  getCurrentUser: async () => null,
}));

import { pode } from "@/server/auth/rbac";
import {
  RepositorioCandidaturasMemoria,
  usarRepositorioCandidaturas,
} from "@/server/candidaturas";
import { ehAppError } from "@/server/errors";
import { RepositorioVagasMemoria, usarRepositorioVagas } from "@/server/vagas";
import { schemaEdicaoVaga } from "@/server/vagas/schemas";
import { editarVaga } from "@/server/vagas/servico";
import type { Vaga } from "@/server/vagas/tipos";

const EMPRESA = { usuarioId: "empresa-1", papel: "empresa" as const };

const VAGA: Vaga = {
  id: "vaga-1",
  empresaId: "empresa-1",
  titulo: "Motorista de Carreta",
  descricao: "Transporte de grãos entre Sorriso e os portos do Norte.",
  categoria: "Logística e Transporte",
  cidade: "Sorriso - MT",
  bairro: "Centro",
  endereco: "Rua das Palmeiras, 50",
  tipoContrato: "CLT",
  modalidade: "presencial",
  paraPcd: false,
  contratanteConfidencial: null,
  salarioMin: 3500,
  salarioMax: 4200,
  habilidades: ["CNH E"],
  perguntas: [],
  status: "aberta",
  criadoEm: "2026-11-01T00:00:00.000Z",
  expiraEm: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
};

const edicao = (mudanca: Partial<Parameters<typeof editarVaga>[1]> = {}) => ({
  id: "vaga-1",
  descricao: "Transporte de grãos. Saída de Sorriso, folga a cada 15 dias.",
  bairro: "Centro",
  endereco: "Rua das Palmeiras, 50, galpão 2",
  habilidades: ["CNH E", "MOPP"],
  salarioMin: 3500,
  salarioMax: 4500,
  ...mudanca,
});

async function capturar(fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch (e) {
    if (ehAppError(e)) return e;
    throw e;
  }
  throw new Error("devia ter recusado");
}

describe("editar vaga", () => {
  let vagas: RepositorioVagasMemoria;
  let candidaturas: RepositorioCandidaturasMemoria;
  const restaurar: (() => void)[] = [];

  beforeEach(() => {
    vagas = new RepositorioVagasMemoria();
    vagas.semear([
      VAGA,
      { ...VAGA, id: "fechada", status: "fechada" },
      { ...VAGA, id: "vencida", expiraEm: "2026-01-01T00:00:00.000Z" },
    ]);
    candidaturas = new RepositorioCandidaturasMemoria();
    restaurar.push(
      usarRepositorioVagas(vagas),
      usarRepositorioCandidaturas(candidaturas),
    );
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    while (restaurar.length) restaurar.pop()?.();
    vi.restoreAllMocks();
  });

  it("a dona corrige o texto, e o que define a vaga continua igual", async () => {
    const editada = await editarVaga(EMPRESA, edicao());

    expect(editada.descricao).toContain("folga a cada 15 dias");
    expect(editada.endereco).toBe("Rua das Palmeiras, 50, galpão 2");
    expect(editada.habilidades).toEqual(["CNH E", "MOPP"]);
    expect(editada.salarioMax).toBe(4500);

    expect(editada.titulo).toBe(VAGA.titulo);
    expect(editada.cidade).toBe(VAGA.cidade);
    expect(editada.tipoContrato).toBe(VAGA.tipoContrato);
    expect(editada.expiraEm).toBe(VAGA.expiraEm);
  });

  it("o schema não deixa passar cargo, cidade nem contrato", () => {
    const r = schemaEdicaoVaga.safeParse({
      ...edicao(),
      titulo: "Gerente Geral",
      cidade: "Cuiabá - MT",
      tipoContrato: "PJ",
      salarioMin: "3500",
      salarioMax: "4500",
      habilidades: "CNH E, MOPP",
    });
    expect(r.success).toBe(true);
    expect(Object.keys(r.success ? r.data : {})).not.toContain("titulo");
    expect(Object.keys(r.success ? r.data : {})).not.toContain("cidade");
    expect(Object.keys(r.success ? r.data : {})).not.toContain("tipoContrato");
  });

  it("outra empresa não edita, e recebe 'não encontrado'", async () => {
    const erro = await capturar(() =>
      editarVaga({ usuarioId: "empresa-2", papel: "empresa" }, edicao()),
    );
    expect(erro.codigo).toBe("nao_encontrado");
    expect((await vagas.porId("vaga-1"))?.descricao).toBe(VAGA.descricao);
  });

  it("candidato não edita", async () => {
    await capturar(() =>
      editarVaga({ usuarioId: "cnd-1", papel: "candidato_clt" }, edicao()),
    );
    expect((await vagas.porId("vaga-1"))?.descricao).toBe(VAGA.descricao);
  });

  it("com candidatura, o salário não diminui", async () => {
    candidaturas.semear([
      {
        id: "c1",
        vagaId: "vaga-1",
        candidatoId: "cnd-1",
        status: "enviada",
        criadoEm: "2026-11-02T00:00:00.000Z",
        respostas: null,
      },
    ]);

    for (const mudanca of [
      { salarioMin: 3000 },
      { salarioMax: 4000 },
      { salarioMin: null, salarioMax: null },
    ]) {
      const erro = await capturar(() => editarVaga(EMPRESA, edicao(mudanca)));
      expect(erro.codigo).toBe("validacao");
    }
    expect((await vagas.porId("vaga-1"))?.salarioMin).toBe(3500);

    // Subir pode.
    const subiu = await editarVaga(EMPRESA, edicao({ salarioMin: 3800 }));
    expect(subiu.salarioMin).toBe(3800);
  });

  it("sem candidatura, o salário pode diminuir", async () => {
    const editada = await editarVaga(EMPRESA, edicao({ salarioMin: 3000 }));
    expect(editada.salarioMin).toBe(3000);
  });

  it.each(["fechada", "vencida"])("vaga %s não se edita", async (id) => {
    const erro = await capturar(() => editarVaga(EMPRESA, edicao({ id })));
    expect(erro.codigo).toBe("conflito");
  });

  it("os três papéis que publicam editam a própria vaga", () => {
    for (const papel of ["empresa", "prestador_servico", "admin"] as const) {
      expect(pode(papel, "vaga:editar_propria")).toBe(true);
    }
    expect(pode("candidato_clt", "vaga:editar_propria")).toBe(false);
  });
});
