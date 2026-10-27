/**
 * @vitest-environment node
 *
 * Candidatar-se a uma vaga com perguntas de triagem (#491).
 *
 * "Sem responder todas, não envia" é regra de produto, e a action pode ser
 * chamada direto: quem confere é o servidor, e o banco confere de novo. O que
 * se prova aqui é o servidor — e que a resposta que chega é a que fica.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: false }));

import type { Autenticado } from "@/server/auth/rbac";
import {
  RepositorioCandidaturasMemoria,
  usarRepositorioCandidaturas,
} from "@/server/candidaturas";
import { candidatarSe } from "@/server/candidaturas/servico";
import { ehAppError } from "@/server/errors";
import { RepositorioVagasMemoria, usarRepositorioVagas } from "@/server/vagas";

const candidato: Autenticado = {
  usuarioId: "candidato-1",
  papel: "candidato_clt",
};

const VAGA_BASE = {
  empresaId: "empresa-1",
  titulo: "Motorista de Carreta",
  descricao: "Transporte de grãos entre Sinop e os portos do Norte.",
  categoria: "Logística e Transporte",
  cidade: "Sinop - MT",
  endereco: "Av. das Itaúbas, 1200",
  tipoContrato: "CLT",
  modalidade: "presencial" as const,
  paraPcd: false,
};

describe("candidatura com perguntas de triagem", () => {
  let vagas: RepositorioVagasMemoria;
  let candidaturas: RepositorioCandidaturasMemoria;
  let restaurar: Array<() => void>;

  beforeEach(() => {
    vagas = new RepositorioVagasMemoria();
    candidaturas = new RepositorioCandidaturasMemoria();
    restaurar = [
      usarRepositorioVagas(vagas),
      usarRepositorioCandidaturas(candidaturas),
    ];
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    for (const r of restaurar) r();
    vi.restoreAllMocks();
  });

  async function vagaComPerguntas() {
    return vagas.criar({
      ...VAGA_BASE,
      perguntas: [
        { texto: "Tem CNH E?", eliminatoria: true },
        { texto: "Pode viajar?", eliminatoria: false },
      ],
    });
  }

  async function erroDe(fn: () => Promise<unknown>) {
    try {
      await fn();
    } catch (e) {
      if (ehAppError(e)) return e;
      throw e;
    }
    throw new Error("era para recusar");
  }

  it("guarda as respostas na ordem das perguntas", async () => {
    const vaga = await vagaComPerguntas();

    const c = await candidatarSe(candidato, vaga.id, [true, false]);

    expect(c.respostas).toEqual([true, false]);
    expect((await candidaturas.porId(c.id))?.respostas).toEqual([true, false]);
  });

  it("sem responder, não envia — e nada é gravado", async () => {
    const vaga = await vagaComPerguntas();

    const erro = await erroDe(() => candidatarSe(candidato, vaga.id));

    expect(erro.codigo).toBe("validacao");
    expect(erro.mensagem).toMatch(/responda a todas as perguntas/i);
    expect(await candidaturas.porVaga(vaga.id)).toEqual([]);
  });

  it("respostas a menos, a mais ou fora do tipo também não passam", async () => {
    const vaga = await vagaComPerguntas();

    for (const respostas of [
      [],
      [true],
      [true, false, true],
      [true, "sim" as unknown as boolean],
    ]) {
      const erro = await erroDe(() =>
        candidatarSe(candidato, vaga.id, respostas),
      );
      expect(erro.codigo).toBe("validacao");
    }
    expect(await candidaturas.porVaga(vaga.id)).toEqual([]);
  });

  /**
   * Eliminatória não bloqueia: quem responde Não **envia**. A empresa o vê
   * em outro grupo, com o motivo — a decisão de olhar é dela.
   */
  it("quem responde Não a uma eliminatória envia do mesmo jeito", async () => {
    const vaga = await vagaComPerguntas();

    const c = await candidatarSe(candidato, vaga.id, [false, false]);

    expect(c.status).toBe("enviada");
    expect(c.respostas).toEqual([false, false]);
  });

  it("vaga sem pergunta não guarda resposta, mesmo que ela venha", async () => {
    const vaga = await vagas.criar(VAGA_BASE);

    const c = await candidatarSe(candidato, vaga.id, [true, true]);

    expect(c.respostas).toBeNull();
  });

  it("vaga sem pergunta continua se candidatando sem nada, como sempre", async () => {
    const vaga = await vagas.criar(VAGA_BASE);

    expect((await candidatarSe(candidato, vaga.id)).respostas).toBeNull();
  });

  it("a candidatura repetida continua sendo recusada", async () => {
    const vaga = await vagaComPerguntas();
    await candidatarSe(candidato, vaga.id, [true, true]);

    const erro = await erroDe(() =>
      candidatarSe(candidato, vaga.id, [true, true]),
    );

    expect(erro.codigo).toBe("conflito");
  });
});
