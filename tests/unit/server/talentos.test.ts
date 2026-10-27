/**
 * @vitest-environment node
 *
 * "Quem já se candidatou": a lista de gente que se candidatou a esta empresa,
 * sem repetir (#494).
 *
 * O limite que decide tudo: **a empresa vê esta pessoa porque ela se
 * candidatou a uma vaga dela**, e só a essa empresa. O que se prova aqui é o
 * que mantém isso verdade — a lista nasce das candidaturas da empresa da
 * sessão, ninguém aparece duas vezes, e quem não tem painel não vê nada.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: true }));

const dados = vi.hoisted(() => ({
  chamadas: [] as string[],
  porEmpresa: new Map<string, unknown[]>(),
}));

vi.mock("@/lib/data", () => ({
  empresaDoPainel: (usuarioId: string) => usuarioId,
  getCompanyApplications: async (empresaId: string) => {
    dados.chamadas.push(empresaId);
    return dados.porEmpresa.get(empresaId) ?? [];
  },
}));

import type { Autenticado } from "@/server/auth/rbac";
import { talentosDaEmpresa } from "@/server/candidaturas/talentos";

const empresa: Autenticado = { usuarioId: "empresa-1", papel: "empresa" };
const outraEmpresa: Autenticado = { usuarioId: "empresa-2", papel: "empresa" };

interface Linha {
  id: string;
  job_id: string;
  candidate_id: string;
  created_at: string;
  job_title: string;
  candidate: {
    full_name: string;
    avatar_url: string | null;
    city: string | null;
    desired_area: string | null;
    skills: string[];
  };
}

function candidatura(
  id: string,
  pessoa: string,
  vaga: string,
  dia: string,
  extra: Partial<Linha["candidate"]> = {},
): Linha {
  return {
    id,
    job_id: `job-${vaga}`,
    candidate_id: pessoa,
    created_at: `2026-10-${dia}T10:00:00.000Z`,
    job_title: vaga,
    candidate: {
      full_name: pessoa,
      avatar_url: null,
      city: "Sinop - MT",
      desired_area: "Logística e Transporte",
      skills: [],
      ...extra,
    },
  };
}

describe("talentosDaEmpresa", () => {
  beforeEach(() => {
    dados.chamadas = [];
    dados.porEmpresa = new Map();
  });

  it("quem se candidatou a três vagas aparece uma vez, com a mais recente", async () => {
    dados.porEmpresa.set("empresa-1", [
      candidatura("c3", "Ana", "Motorista", "20"),
      candidatura("c2", "Ana", "Ajudante", "15"),
      candidatura("c1", "Ana", "Conferente", "10"),
    ]);

    const lista = await talentosDaEmpresa(empresa);

    expect(lista).toHaveLength(1);
    expect(lista[0]).toMatchObject({
      nome: "Ana",
      vagas: 3,
      ultima: { candidaturaId: "c3", vagaTitulo: "Motorista" },
    });
  });

  /** A regra não depende de a lista chegar da mais nova para a mais velha. */
  it("a mais recente é a de data maior, em qualquer ordem de chegada", async () => {
    dados.porEmpresa.set("empresa-1", [
      candidatura("c1", "Ana", "Conferente", "10"),
      candidatura("c3", "Ana", "Motorista", "20"),
      candidatura("c2", "Ana", "Ajudante", "15"),
    ]);

    expect((await talentosDaEmpresa(empresa))[0].ultima.candidaturaId).toBe(
      "c3",
    );
  });

  it("ordena pela candidatura mais recente de cada pessoa", async () => {
    dados.porEmpresa.set("empresa-1", [
      candidatura("c1", "Ana", "Motorista", "10"),
      candidatura("c2", "Bia", "Motorista", "25"),
      candidatura("c3", "Caio", "Motorista", "18"),
    ]);

    expect((await talentosDaEmpresa(empresa)).map((t) => t.nome)).toEqual([
      "Bia",
      "Caio",
      "Ana",
    ]);
  });

  /**
   * O limite do consentimento: a lista nasce das candidaturas **desta**
   * empresa. Outra empresa não alcança a candidatura de ninguém.
   */
  it("só consulta as candidaturas da empresa da sessão", async () => {
    dados.porEmpresa.set("empresa-1", [candidatura("c1", "Ana", "X", "10")]);
    dados.porEmpresa.set("empresa-2", [candidatura("c2", "Bia", "Y", "11")]);

    expect((await talentosDaEmpresa(empresa)).map((t) => t.nome)).toEqual([
      "Ana",
    ]);
    expect((await talentosDaEmpresa(outraEmpresa)).map((t) => t.nome)).toEqual([
      "Bia",
    ]);
    expect(dados.chamadas).toEqual(["empresa-1", "empresa-2"]);
  });

  describe("filtros", () => {
    beforeEach(() => {
      dados.porEmpresa.set("empresa-1", [
        candidatura("c1", "Ana", "Motorista", "10", {
          skills: ["CNH D", "Colheitadeira"],
        }),
        candidatura("c2", "Bia", "Caixa", "11", {
          skills: ["Atendimento"],
          desired_area: "Comércio e Vendas",
        }),
      ]);
    });

    it("por habilidade, e a que casou vem para a tela destacar", async () => {
      const lista = await talentosDaEmpresa(empresa, {
        habilidade: "colheitadeira",
      });

      expect(lista.map((t) => t.nome)).toEqual(["Ana"]);
      expect(lista[0].casadas).toEqual(["Colheitadeira"]);
    });

    /** A mesma tabela de sinônimos da busca de candidatos e do casamento. */
    it("pelos sinônimos: quem procura 'carteira D' acha quem escreveu 'CNH D'", async () => {
      const lista = await talentosDaEmpresa(empresa, {
        habilidade: "carteira D",
      });

      expect(lista.map((t) => t.nome)).toEqual(["Ana"]);
    });

    it("por área desejada", async () => {
      const lista = await talentosDaEmpresa(empresa, {
        area: "Comércio e Vendas",
      });

      expect(lista.map((t) => t.nome)).toEqual(["Bia"]);
    });

    it("os dois juntos", async () => {
      expect(
        await talentosDaEmpresa(empresa, {
          habilidade: "colheitadeira",
          area: "Comércio e Vendas",
        }),
      ).toEqual([]);
    });

    it("filtro que não casa com ninguém devolve vazio, não erro", async () => {
      expect(
        await talentosDaEmpresa(empresa, { habilidade: "pilotar foguete" }),
      ).toEqual([]);
    });

    /**
     * Habilidade e área são da pessoa, não da candidatura: quem passou no
     * filtro aparece uma vez só, mesmo com várias candidaturas.
     */
    it("com filtro, quem se candidatou a mais de uma vaga continua aparecendo uma vez", async () => {
      dados.porEmpresa.set("empresa-1", [
        candidatura("c2", "Ana", "Caixa", "12", { skills: ["CNH D"] }),
        candidatura("c1", "Ana", "Motorista", "10", { skills: ["CNH D"] }),
      ]);

      const lista = await talentosDaEmpresa(empresa, { habilidade: "CNH D" });

      expect(lista).toHaveLength(1);
      expect(lista[0].vagas).toBe(2);
    });
  });

  describe("quem pode ver", () => {
    beforeEach(() => {
      dados.porEmpresa.set("empresa-1", [candidatura("c1", "Ana", "X", "10")]);
    });

    it("sem sessão, nada — e nenhuma consulta", async () => {
      expect(await talentosDaEmpresa(null)).toEqual([]);
      expect(dados.chamadas).toEqual([]);
    });

    it("candidato não tem painel de empresa: nada, e nenhuma consulta", async () => {
      expect(
        await talentosDaEmpresa({
          usuarioId: "candidato-1",
          papel: "candidato_clt",
        }),
      ).toEqual([]);
      expect(dados.chamadas).toEqual([]);
    });

    it("prestador que contrata vê as candidaturas às vagas dele", async () => {
      dados.porEmpresa.set("prestador-1", [
        candidatura("c9", "Davi", "Ajudante", "12"),
      ]);

      const lista = await talentosDaEmpresa({
        usuarioId: "prestador-1",
        papel: "prestador_servico",
      });

      expect(lista.map((t) => t.nome)).toEqual(["Davi"]);
    });
  });
});
