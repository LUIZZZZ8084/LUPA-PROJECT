/**
 * @vitest-environment node
 *
 * "Processo sem movimentação" no painel da empresa (#610).
 */
import { describe, expect, it } from "vitest";
import {
  type CandidaturaDoPainel,
  contarVagasAtivas,
  DIAS_PARA_PARAR,
  diasAteVencer,
  processosParados,
  type VagaDoPainel,
} from "@/lib/pendencias-do-painel";
import { RepositorioCandidaturasMemoria } from "@/server/candidaturas/memoria";

const AGORA = new Date("2026-11-10T12:00:00Z");
const ha = (dias: number) =>
  new Date(AGORA.getTime() - dias * 86_400_000).toISOString();
const daqui = (dias: number) =>
  new Date(AGORA.getTime() + dias * 86_400_000).toISOString();

const vaga = (id: string, extra: Partial<VagaDoPainel> = {}): VagaDoPainel => ({
  id,
  title: `Vaga ${id}`,
  status: "aberta",
  expires_at: daqui(20),
  ...extra,
});
const cand = (
  id: string,
  job_id: string,
  status: CandidaturaDoPainel["status"],
  dias: number,
): CandidaturaDoPainel => ({ id, job_id, status, created_at: ha(dias) });

describe("processosParados", () => {
  it("vaga com gente esperando e ninguém mexendo há 7 dias está parada", () => {
    expect(
      processosParados(
        [vaga("v1")],
        [cand("a", "v1", "enviada", 9), cand("b", "v1", "visualizada", 12)],
        new Map(),
        AGORA,
      ),
    ).toEqual([{ vagaId: "v1", titulo: "Vaga v1", esperando: 2, dias: 9 }]);
    expect(DIAS_PARA_PARAR).toBe(7);
  });

  it("mexer em uma pessoa prova que o processo anda: a vaga inteira sai", () => {
    expect(
      processosParados(
        [vaga("v1")],
        [cand("a", "v1", "enviada", 9), cand("b", "v1", "contatada", 12)],
        new Map([["b", ha(2)]]),
        AGORA,
      ),
    ).toEqual([]);
  });

  it("candidatura nova na semana não deixa a vaga parada", () => {
    expect(
      processosParados(
        [vaga("v1")],
        [cand("a", "v1", "enviada", 30), cand("b", "v1", "enviada", 1)],
        new Map(),
        AGORA,
      ),
    ).toEqual([]);
  });

  it("aprovado, contratado e reprovado não esperam triagem", () => {
    expect(
      processosParados(
        [vaga("v1")],
        [
          cand("a", "v1", "aprovada", 30),
          cand("b", "v1", "contratada", 30),
          cand("c", "v1", "rejeitada", 30),
        ],
        new Map(),
        AGORA,
      ),
    ).toEqual([]);
  });

  it("vaga encerrada ou vencida não tem processo para andar", () => {
    expect(
      processosParados(
        [
          vaga("fechada", { status: "fechada" }),
          vaga("vencida", { expires_at: ha(1) }),
        ],
        [
          cand("a", "fechada", "enviada", 30),
          cand("b", "vencida", "enviada", 30),
        ],
        new Map(),
        AGORA,
      ),
    ).toEqual([]);
  });

  it("o mais parado vem primeiro", () => {
    const r = processosParados(
      [vaga("v1"), vaga("v2")],
      [cand("a", "v1", "enviada", 8), cand("b", "v2", "entrevista", 20)],
      new Map(),
      AGORA,
    );
    expect(r.map((p) => p.vagaId)).toEqual(["v2", "v1"]);
  });
});

describe("vagas ativas e prazo", () => {
  it("ativa é aberta e dentro do prazo", () => {
    expect(
      contarVagasAtivas(
        [
          vaga("a"),
          vaga("b", { status: "fechada" }),
          vaga("c", { expires_at: ha(1) }),
        ],
        AGORA,
      ),
    ).toBe(1);
  });

  it("dias até vencer arredonda para cima, e nunca diz zero", () => {
    expect(diasAteVencer(daqui(2.2), AGORA)).toBe(3);
    expect(diasAteVencer(daqui(0.1), AGORA)).toBe(1);
  });
});

describe("ultimasMovimentacoes em memória", () => {
  it("devolve a mais recente de cada candidatura pedida, e só delas", async () => {
    const repo = new RepositorioCandidaturasMemoria();
    const a = await repo.criar({ vagaId: "v", candidatoId: "p1" });
    const b = await repo.criar({ vagaId: "v", candidatoId: "p2" });
    const c = await repo.criar({ vagaId: "v", candidatoId: "p3" });
    await repo.moverEstagio(a.id, "visualizada", null);
    await repo.moverEstagio(a.id, "contatada", "empresa");
    await repo.moverEstagio(c.id, "rejeitada", "empresa");

    const ultimas = await repo.ultimasMovimentacoes([a.id, b.id]);
    expect([...ultimas.keys()]).toEqual([a.id]);
    const historico = await repo.historicoDe(a.id);
    expect(ultimas.get(a.id)).toBe(historico[0].criadoEm);
    expect(historico.map((e) => e.tipo === "etapa" && e.para)).toEqual([
      "contatada",
      "visualizada",
    ]);
  });
});
