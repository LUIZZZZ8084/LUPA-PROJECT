/**
 * @vitest-environment node
 *
 * A ficha do candidato (#618): registrar contato e salvar nos talentos.
 *
 * O que se prova: só a empresa dona da vaga registra e salva; o contato entra
 * no histórico com quem registrou; salvar é por pessoa, e tirar desfaz.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/data", () => ({
  empresaDoPainel: (usuarioId: string) => usuarioId,
}));

import {
  RepositorioCandidaturasMemoria,
  repositorioCandidaturas,
  usarRepositorioCandidaturas,
} from "@/server/candidaturas";
import type { Candidatura } from "@/server/candidaturas/tipos";
import {
  RepositorioTalentosMemoria,
  usarRepositorioTalentos,
} from "@/server/talentos";
import {
  definirTalento,
  registrarContato,
  talentosSalvosDa,
} from "@/server/talentos/servico";
import { RepositorioVagasMemoria, usarRepositorioVagas } from "@/server/vagas";
import type { Vaga } from "@/server/vagas/tipos";

const EMPRESA = { usuarioId: "empresa-1", papel: "empresa" as const };
const OUTRA = { usuarioId: "empresa-2", papel: "empresa" as const };
const CANDIDATO = { usuarioId: "cnd-a", papel: "candidato_clt" as const };

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

const CANDIDATURA: Candidatura = {
  id: "c1",
  vagaId: "vaga-1",
  candidatoId: "cnd-a",
  status: "visualizada",
  criadoEm: "2026-11-02T00:00:00.000Z",
  respostas: null,
};

describe("ficha do candidato", () => {
  const restaurar: (() => void)[] = [];

  beforeEach(() => {
    const vagas = new RepositorioVagasMemoria();
    vagas.semear([VAGA]);
    const candidaturas = new RepositorioCandidaturasMemoria();
    candidaturas.semear([CANDIDATURA]);
    restaurar.push(
      usarRepositorioVagas(vagas),
      usarRepositorioCandidaturas(candidaturas),
      usarRepositorioTalentos(new RepositorioTalentosMemoria()),
    );
  });

  afterEach(() => {
    while (restaurar.length) restaurar.pop()?.();
  });

  it("o contato entra no histórico, com quem registrou, e a etapa não muda", async () => {
    await registrarContato(EMPRESA, {
      candidaturaId: "c1",
      nota: "Liguei, retorna amanhã.",
    });
    const historico = await repositorioCandidaturas().historicoDe("c1");
    expect(historico).toHaveLength(1);
    expect(historico[0]).toMatchObject({
      tipo: "contato",
      nota: "Liguei, retorna amanhã.",
      autorId: "empresa-1",
    });
    expect((await repositorioCandidaturas().porId("c1"))?.status).toBe(
      "visualizada",
    );
  });

  it("mover de etapa e registrar contato ficam na mesma linha do tempo, do mais novo ao mais velho", async () => {
    await repositorioCandidaturas().moverEstagio(
      "c1",
      "contatada",
      "empresa-1",
    );
    await registrarContato(EMPRESA, {
      candidaturaId: "c1",
      nota: "Combinado.",
    });
    const tipos = (await repositorioCandidaturas().historicoDe("c1")).map(
      (e) => e.tipo,
    );
    expect(tipos).toEqual(["contato", "etapa"]);
  });

  it("outra empresa e o candidato não registram nem salvam", async () => {
    for (const quem of [OUTRA, CANDIDATO]) {
      await expect(
        registrarContato(quem, { candidaturaId: "c1", nota: "x" }),
      ).rejects.toThrow();
      await expect(
        definirTalento(quem, { candidaturaId: "c1", salvo: true }),
      ).rejects.toThrow();
    }
    expect(await repositorioCandidaturas().historicoDe("c1")).toEqual([]);
    expect((await talentosSalvosDa(OUTRA)).size).toBe(0);
  });

  it("salvar guarda a pessoa, não a candidatura; tirar desfaz", async () => {
    await definirTalento(EMPRESA, { candidaturaId: "c1", salvo: true });
    await definirTalento(EMPRESA, { candidaturaId: "c1", salvo: true });
    expect([...(await talentosSalvosDa(EMPRESA))]).toEqual(["cnd-a"]);

    await definirTalento(EMPRESA, { candidaturaId: "c1", salvo: false });
    expect((await talentosSalvosDa(EMPRESA)).size).toBe(0);
  });

  it("candidatura que não existe é não encontrada", async () => {
    await expect(
      definirTalento(EMPRESA, { candidaturaId: "nao-existe", salvo: true }),
    ).rejects.toThrow();
  });

  it("sem sessão, ninguém salvo", async () => {
    expect((await talentosSalvosDa(null)).size).toBe(0);
  });
});
