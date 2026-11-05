/**
 * @vitest-environment node
 *
 * Anotações e entrevista na ficha da candidatura (#539).
 *
 * O que se prova: só a empresa dona da vaga escreve; marcar a entrevista leva
 * a pessoa ao estágio de entrevista quando ela ainda estava antes dele, e não
 * tira ninguém de um estágio adiante; e a validação aceita salvar em branco.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// A empresa do painel é a própria conta, como em produção: é o que permite
// medir "outra empresa" sem o atalho da demonstração.
vi.mock("@/lib/data", () => ({
  empresaDoPainel: (usuarioId: string) => usuarioId,
}));

import {
  RepositorioAcompanhamentoMemoria,
  usarRepositorioAcompanhamento,
} from "@/server/acompanhamento";
import { schemaAcompanhamento } from "@/server/acompanhamento/schemas";
import {
  acompanhamentosDe,
  salvarAcompanhamento,
} from "@/server/acompanhamento/servico";
import {
  RepositorioCandidaturasMemoria,
  repositorioCandidaturas,
  usarRepositorioCandidaturas,
} from "@/server/candidaturas";
import type { Candidatura } from "@/server/candidaturas/tipos";
import { RepositorioVagasMemoria, usarRepositorioVagas } from "@/server/vagas";
import type { Vaga } from "@/server/vagas/tipos";

const EMPRESA = { usuarioId: "empresa-1", papel: "empresa" as const };
const OUTRA = { usuarioId: "empresa-2", papel: "empresa" as const };

const VAGA: Vaga = {
  id: "vaga-1",
  empresaId: "empresa-1",
  titulo: "Motorista",
  descricao: "Transporte de grãos.",
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
  criadoEm: "2026-11-01T00:00:00.000Z",
  expiraEm: "2026-12-01T00:00:00.000Z",
};

const candidatura = (
  id: string,
  status: Candidatura["status"],
): Candidatura => ({
  id,
  vagaId: "vaga-1",
  candidatoId: `cnd-${id}`,
  status,
  criadoEm: "2026-11-02T00:00:00.000Z",
  respostas: null,
});

const dados = (candidaturaId: string, entrevistaEm: string | null) => ({
  candidaturaId,
  anotacao: "Boa conversa. Pede R$ 2.500.",
  entrevistaEm,
  entrevistaLocal: entrevistaEm ? "Av. das Itaúbas, 1200" : null,
  etiquetas: [],
});

describe("salvar acompanhamento", () => {
  const restaurar: (() => void)[] = [];

  beforeEach(() => {
    const vagas = new RepositorioVagasMemoria();
    vagas.semear([VAGA]);
    const candidaturas = new RepositorioCandidaturasMemoria();
    candidaturas.semear([
      candidatura("nova", "enviada"),
      candidatura("vista", "visualizada"),
      candidatura("aprovada", "aprovada"),
    ]);
    restaurar.push(
      usarRepositorioVagas(vagas),
      usarRepositorioCandidaturas(candidaturas),
      usarRepositorioAcompanhamento(new RepositorioAcompanhamentoMemoria()),
    );
  });

  afterEach(() => {
    while (restaurar.length) restaurar.pop()?.();
  });

  it("a empresa dona anota, e lê de volta pela lista", async () => {
    await salvarAcompanhamento(EMPRESA, dados("vista", null));

    const lidos = await acompanhamentosDe(["vista", "nova"]);
    expect(lidos.get("vista")?.anotacao).toBe("Boa conversa. Pede R$ 2.500.");
    expect(lidos.has("nova")).toBe(false);
  });

  it("outra empresa não escreve, e nada é gravado", async () => {
    await expect(
      salvarAcompanhamento(OUTRA, dados("vista", "2026-11-06T14:30")),
    ).rejects.toThrow();
    expect((await acompanhamentosDe(["vista"])).size).toBe(0);
  });

  it("candidato não escreve", async () => {
    await expect(
      salvarAcompanhamento(
        { usuarioId: "cnd-1", papel: "candidato_clt" },
        dados("vista", null),
      ),
    ).rejects.toThrow();
  });

  it("marcar a entrevista leva a nova e a vista ao estágio de entrevista", async () => {
    await salvarAcompanhamento(EMPRESA, dados("nova", "2026-11-06T14:30"));
    await salvarAcompanhamento(EMPRESA, dados("vista", "2026-11-07T09:00"));

    expect((await repositorioCandidaturas().porId("nova"))?.status).toBe(
      "entrevista",
    );
    expect((await repositorioCandidaturas().porId("vista"))?.status).toBe(
      "entrevista",
    );
  });

  it("quem já foi selecionado não volta para entrevista", async () => {
    await salvarAcompanhamento(EMPRESA, dados("aprovada", "2026-11-06T14:30"));
    expect((await repositorioCandidaturas().porId("aprovada"))?.status).toBe(
      "aprovada",
    );
  });

  it("só anotar não mexe no estágio", async () => {
    await salvarAcompanhamento(EMPRESA, dados("nova", null));
    expect((await repositorioCandidaturas().porId("nova"))?.status).toBe(
      "enviada",
    );
  });
});

describe("schemaAcompanhamento", () => {
  it("em branco é válido: sem anotação e sem entrevista", () => {
    const r = schemaAcompanhamento.safeParse({
      candidaturaId: "c1",
      anotacao: "",
      entrevistaEm: "",
      entrevistaLocal: "",
    });
    expect(r.success && r.data).toEqual({
      candidaturaId: "c1",
      anotacao: "",
      entrevistaEm: null,
      entrevistaLocal: null,
      etiquetas: [],
    });
  });

  it("etiquetas viram minúsculas, sem espaço repetido nem repetidas", () => {
    const r = schemaAcompanhamento.safeParse({
      candidaturaId: "c1",
      etiquetas: " Banco de  talentos, chamar na próxima ,banco de talentos,",
    });
    expect(r.success && r.data.etiquetas).toEqual([
      "banco de talentos",
      "chamar na próxima",
    ]);
  });

  it.each([
    ["mais de cinco", "a1, a2, a3, a4, a5, a6"],
    ["uma curta demais", "x"],
    ["uma longa demais", "x".repeat(31)],
  ])("recusa etiquetas com %s", (_motivo, etiquetas) => {
    expect(
      schemaAcompanhamento.safeParse({ candidaturaId: "c1", etiquetas })
        .success,
    ).toBe(false);
  });

  it.each(["06/11/2026 14:30", "2026-11-06", "2026-13-40T99:99"])(
    "recusa a data %s",
    (entrevistaEm) => {
      const r = schemaAcompanhamento.safeParse({
        candidaturaId: "c1",
        entrevistaEm,
      });
      expect(r.success).toBe(false);
    },
  );

  it("recusa anotação acima de 2000 letras", () => {
    const r = schemaAcompanhamento.safeParse({
      candidaturaId: "c1",
      anotacao: "x".repeat(2001),
    });
    expect(r.success).toBe(false);
  });
});
