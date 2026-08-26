/**
 * @vitest-environment node
 *
 * "Recomendados para você".
 *
 * O teste que mais importa aqui não é o da ordenação: é o que trava o
 * escopo. Recomendar gente que não se candidatou seria banco de talentos
 * com busca ativa — fora do escopo por decisão, porque hoje a pessoa se
 * expõe a uma empresa no momento em que decide se candidatar a ela.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: true }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => null,
  getCurrentUser: async () => null,
}));

const vagas: Record<string, unknown[]> = {};
const candidaturas: Record<string, unknown[]> = {};

vi.mock("@/lib/data", () => ({
  empresaDoPainel: (id: string) => id,
  getCompanyJobs: async (empresaId: string) => vagas[empresaId] ?? [],
  getCompanyApplications: async (empresaId: string) =>
    candidaturas[empresaId] ?? [],
}));

import type { Autenticado } from "@/server/auth/rbac";
import { recomendadosParaEmpresa } from "@/server/candidaturas/recomendados";

const empresa: Autenticado = { usuarioId: "empresa-1", papel: "empresa" };
const outraEmpresa: Autenticado = { usuarioId: "empresa-2", papel: "empresa" };
const candidato: Autenticado = { usuarioId: "cand-1", papel: "candidato_clt" };

function vaga(over: Record<string, unknown> = {}) {
  return {
    id: "vaga-1",
    title: "Operador de Colheitadeira",
    description: "Safra de soja, turno diurno.",
    skills: ["Colheitadeira", "CNH D"],
    status: "aberta",
    ...over,
  };
}

function candidatura(
  id: string,
  skills: string[],
  over: Record<string, unknown> = {},
) {
  return {
    id,
    job_id: "vaga-1",
    candidate_id: `c-${id}`,
    status: "enviada",
    created_at: "2026-08-20T12:00:00.000Z",
    job_title: "Operador de Colheitadeira",
    candidate: { full_name: `Pessoa ${id}`, avatar_url: null, skills },
    ...over,
  };
}

beforeEach(() => {
  for (const k of Object.keys(vagas)) delete vagas[k];
  for (const k of Object.keys(candidaturas)) delete candidaturas[k];
  vagas["empresa-1"] = [vaga()];
});

describe("o escopo — só quem se candidatou", () => {
  /*
   * Este teste é a decisão de produto virada em código. Se um dia alguém
   * quiser abrir o banco de talentos, vai ter que apagar este teste — e
   * apagar um teste com este comentário é uma decisão consciente, não um
   * descuido.
   */
  it("ninguém que não se candidatou entra na lista", async () => {
    candidaturas["empresa-1"] = [candidatura("a", ["Colheitadeira"])];

    // Uma pessoa com o perfil perfeito, mas que se candidatou a outra
    // vaga, de outra empresa.
    candidaturas["empresa-2"] = [
      candidatura("b", ["Colheitadeira", "CNH D"], { job_id: "vaga-outra" }),
    ];

    const r = await recomendadosParaEmpresa(empresa);
    const nomes = r[0].recomendados.map((x) => x.candidatura.id);

    expect(nomes).toEqual(["a"]);
  });

  it("candidatura de outra vaga da mesma empresa não se mistura", async () => {
    vagas["empresa-1"] = [vaga(), vaga({ id: "vaga-2", title: "Outra" })];
    candidaturas["empresa-1"] = [
      candidatura("a", ["Colheitadeira"]),
      candidatura("b", ["Colheitadeira"], { job_id: "vaga-2" }),
    ];

    const r = await recomendadosParaEmpresa(empresa);
    const daPrimeira = r.find((v) => v.vagaId === "vaga-1");

    expect(daPrimeira?.recomendados.map((x) => x.candidatura.id)).toEqual([
      "a",
    ]);
  });

  it("outra empresa não recebe nada da minha", async () => {
    candidaturas["empresa-1"] = [candidatura("a", ["Colheitadeira"])];
    expect(await recomendadosParaEmpresa(outraEmpresa)).toEqual([]);
  });

  it("candidato não recebe recomendação de candidato", async () => {
    candidaturas["empresa-1"] = [candidatura("a", ["Colheitadeira"])];
    expect(await recomendadosParaEmpresa(candidato)).toEqual([]);
  });

  it("sem sessão, nada", async () => {
    expect(await recomendadosParaEmpresa(null)).toEqual([]);
  });
});

describe("a ordem, e o porquê dela", () => {
  it("mais habilidades casadas vem primeiro", async () => {
    candidaturas["empresa-1"] = [
      candidatura("uma", ["Colheitadeira"]),
      candidatura("duas", ["Colhedora", "Carteira D"]),
    ];

    const r = await recomendadosParaEmpresa(empresa);
    expect(r[0].recomendados.map((x) => x.candidatura.id)).toEqual([
      "duas",
      "uma",
    ]);
  });

  /*
   * Sem desempate, a ordem entre iguais vem do banco e muda de uma recarga
   * para outra. Lista que dança sozinha faz quem está vendo duvidar do
   * critério inteiro.
   */
  it("empate desempata pelo mais recente, não pelo acaso", async () => {
    candidaturas["empresa-1"] = [
      candidatura("velha", ["Colheitadeira"], {
        created_at: "2026-08-01T12:00:00.000Z",
      }),
      candidatura("nova", ["Colheitadeira"], {
        created_at: "2026-08-24T12:00:00.000Z",
      }),
    ];

    const r = await recomendadosParaEmpresa(empresa);
    expect(r[0].recomendados.map((x) => x.candidatura.id)).toEqual([
      "nova",
      "velha",
    ]);
  });

  it("diz quais habilidades casaram, com o texto do candidato", async () => {
    candidaturas["empresa-1"] = [candidatura("a", ["Colhedora", "Solda"])];

    const r = await recomendadosParaEmpresa(empresa);
    const primeiro = r[0].recomendados[0];

    expect(primeiro.casadas.map((c) => c.texto)).toEqual(["Colhedora"]);
    expect(primeiro.deQuantas).toBe(2);
  });

  it("mostra no máximo três por vaga", async () => {
    candidaturas["empresa-1"] = Array.from({ length: 6 }, (_, i) =>
      candidatura(`c${i}`, ["Colheitadeira", "CNH D"]),
    );

    const r = await recomendadosParaEmpresa(empresa);
    expect(r[0].recomendados).toHaveLength(3);
  });
});

describe("quando não há o que recomendar", () => {
  /*
   * Bloco vazio é resposta honesta. Listar por ordem de chegada e chamar
   * de recomendação é pior que não recomendar: a empresa segue o critério
   * uma vez, não dá certo, e para de olhar o bloco para sempre.
   */
  it("quem não casa nada não aparece", async () => {
    candidaturas["empresa-1"] = [candidatura("a", ["Excel", "Recepção"])];
    expect(await recomendadosParaEmpresa(empresa)).toEqual([]);
  });

  it("vaga fechada fica de fora", async () => {
    vagas["empresa-1"] = [vaga({ status: "fechada" })];
    candidaturas["empresa-1"] = [candidatura("a", ["Colheitadeira"])];

    expect(await recomendadosParaEmpresa(empresa)).toEqual([]);
  });

  it("vaga sem habilidade reconhecível não entra", async () => {
    vagas["empresa-1"] = [
      vaga({
        skills: [],
        title: "Profissional dedicado",
        description: "Buscamos alguém pontual e comprometido.",
      }),
    ];
    candidaturas["empresa-1"] = [candidatura("a", ["Excel"])];

    expect(await recomendadosParaEmpresa(empresa)).toEqual([]);
  });
});

/**
 * Toda vaga publicada antes do campo existir chega sem habilidade
 * declarada. Sem a leitura do texto, o bloco nasceria vazio para todo
 * mundo — e ninguém preenche um campo cujo resultado nunca viu.
 */
describe("vaga antiga, sem habilidades declaradas", () => {
  it("casa pelo título e pela descrição", async () => {
    vagas["empresa-1"] = [
      vaga({
        skills: [],
        title: "Operador de Empilhadeira",
        description: "Movimentação de carga e controle de estoque.",
      }),
    ];
    candidaturas["empresa-1"] = [candidatura("a", ["Empilhadeira"])];

    const r = await recomendadosParaEmpresa(empresa);
    expect(r[0].recomendados.map((x) => x.candidatura.id)).toEqual(["a"]);
  });
});
