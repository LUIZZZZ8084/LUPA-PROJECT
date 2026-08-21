import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Exercita o caminho do Supabase da camada de dados.
 *
 * Os outros testes rodam no modo demonstração, que é o fallback. Este aqui
 * cobre o código que vai realmente executar quando o banco estiver ligado —
 * inclusive a regra de cair para os dados de exemplo quando a consulta
 * falha, que é o que impede o app de mostrar tela vazia num incidente.
 */

interface RespostaFalsa {
  data: unknown;
  error: unknown;
}

/** Encadeador que imita o query builder do supabase-js. */
function criarQueryBuilder(resposta: RespostaFalsa) {
  const chamadas: { metodo: string; args: unknown[] }[] = [];

  const builder: Record<string, unknown> = {
    chamadas,
    then(resolve: (v: RespostaFalsa) => unknown) {
      return Promise.resolve(resposta).then(resolve);
    },
    maybeSingle: vi.fn(async () => resposta),
  };

  for (const metodo of ["select", "eq", "gte", "or", "order"]) {
    builder[metodo] = vi.fn((...args: unknown[]) => {
      chamadas.push({ metodo, args });
      return builder;
    });
  }

  return builder;
}

const tabelasConsultadas: string[] = [];
let respostaAtual: RespostaFalsa = { data: [], error: null };
let ultimoBuilder: ReturnType<typeof criarQueryBuilder>;

vi.mock("@/lib/supabase/config", () => ({
  SUPABASE_URL: "https://exemplo.supabase.co",
  SUPABASE_ANON_KEY: "chave",
  isSupabaseConfigured: true,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: (tabela: string) => {
      tabelasConsultadas.push(tabela);
      ultimoBuilder = criarQueryBuilder(respostaAtual);
      return ultimoBuilder;
    },
  }),
  getCurrentUser: async () => null,
}));

import {
  getCompanyApplications,
  getCompanyJobs,
  getJobById,
  getJobs,
  getProviderById,
  getProviders,
  getReviews,
  getVerificationQueue,
} from "@/lib/data";

const VAGA_DO_BANCO = {
  id: "vaga-do-banco",
  company_id: "empresa-1",
  title: "Vaga vinda do Postgres",
  description: "descrição",
  category: "Agronegócio",
  city: "Sinop",
  neighborhood: null,
  contract_type: "CLT",
  salary_min: 2000,
  salary_max: 3000,
  status: "aberta",
  created_at: new Date().toISOString(),
  company: { company_name: "Empresa 1", logo_url: null, doc_verified: true },
  applicant_count: 3,
};

describe("camada de dados com Supabase ligado", () => {
  beforeEach(() => {
    tabelasConsultadas.length = 0;
    respostaAtual = { data: [], error: null };
  });

  it("lê vagas da view job_listings, não dos dados de exemplo", async () => {
    respostaAtual = { data: [VAGA_DO_BANCO], error: null };

    const vagas = await getJobs();

    expect(tabelasConsultadas).toContain("job_listings");
    expect(vagas).toHaveLength(1);
    expect(vagas[0].title).toBe("Vaga vinda do Postgres");
  });

  it("traduz cada filtro em uma cláusula da consulta", async () => {
    respostaAtual = { data: [], error: null };

    await getJobs({
      city: "Sinop",
      category: "Agronegócio",
      contract_type: "CLT",
      q: "operador",
    });

    const chamadas = ultimoBuilder.chamadas as {
      metodo: string;
      args: unknown[];
    }[];
    const eqs = chamadas
      .filter((c) => c.metodo === "eq")
      .flatMap((c) => c.args);

    expect(eqs).toContain("Sinop");
    expect(eqs).toContain("Agronegócio");
    expect(eqs).toContain("CLT");
    // Só vagas abertas chegam à busca pública.
    expect(eqs).toContain("aberta");
    expect(chamadas.some((c) => c.metodo === "or")).toBe(true);
  });

  it("aplica nota mínima como gte na busca de prestadores", async () => {
    respostaAtual = { data: [], error: null };

    await getProviders({ min_rating: 4.5, category: "eletricista" });

    const chamadas = ultimoBuilder.chamadas as {
      metodo: string;
      args: unknown[];
    }[];
    expect(chamadas.some((c) => c.metodo === "gte" && c.args[1] === 4.5)).toBe(
      true,
    );
    expect(tabelasConsultadas).toContain("provider_listings");
  });

  it("consulta as views certas de cada tela", async () => {
    await getReviews("prv-1");
    expect(tabelasConsultadas).toContain("avaliacoes");

    await getCompanyJobs("empresa-1");
    expect(tabelasConsultadas).toContain("job_listings");

    await getCompanyApplications("empresa-1");
    expect(tabelasConsultadas).toContain("company_applications");

    await getVerificationQueue();
    expect(tabelasConsultadas).toContain("verification_queue");
  });

  it("busca por id devolve o registro do banco", async () => {
    respostaAtual = { data: VAGA_DO_BANCO, error: null };
    const vaga = await getJobById("vaga-do-banco");
    expect(vaga?.title).toBe("Vaga vinda do Postgres");

    respostaAtual = {
      data: { profile_id: "prv-1", full_name: "Prestador do Banco" },
      error: null,
    };
    const prestador = await getProviderById("prv-1");
    expect(prestador?.full_name).toBe("Prestador do Banco");
  });

  /*
   * Estes dois testes exigiam o contrário até a integração com o Supabase
   * entrar no ar, e a razão original era boa:
   *
   *   "se o Postgres cair, a tela mostra os dados de exemplo em vez de uma
   *    lista vazia. Numa demonstração ao vivo para um dono de loja em
   *    Sinop, isso é a diferença entre um tropeço e um app aparentemente
   *    quebrado."
   *
   * Valia enquanto a plateia era um dono de loja assistindo a uma demo. Com
   * o banco ligado, a plateia passou a ser gente de Sinop procurando
   * emprego — e aí o mesmo comportamento serve vaga que não existe, sem o
   * aviso de demonstração, para quem vai gastar crédito atrás dela.
   *
   * Custou caro antes de ser percebido: `/servicos/prv-joao-silva`, id que
   * só existe no mock, respondia HTTP 200 em produção com perfil completo e
   * botão de WhatsApp para um número que podia ser de alguém.
   */
  it("consulta que falha vira exceção, não dado de exemplo", async () => {
    respostaAtual = { data: null, error: { message: "conexão recusada" } };

    await expect(getJobs()).rejects.toThrow(/job_listings/);
    await expect(getProviders()).rejects.toThrow(/provider_listings/);
  });

  it("a exceção diz o que falhou, para não sumir no log", async () => {
    respostaAtual = { data: null, error: { message: "conexão recusada" } };

    await expect(getJobs()).rejects.toThrow(/conexão recusada/);
  });

  /*
   * Registro ausente é "não encontrado", não motivo para procurar no mock.
   * Cair no mock aqui é o que ressuscitava ids que não existem no banco.
   */
  it("registro inexistente devolve null, sem procurar no mock", async () => {
    respostaAtual = { data: null, error: null };
    expect(await getJobById("job-operador-maquinas")).toBeNull();
  });

  it("lista vazia é lista vazia, não catálogo de exemplo", async () => {
    respostaAtual = { data: [], error: null };
    expect(await getJobs()).toEqual([]);
  });
});
