import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

/**
 * `company_applications` e `verification_queue` carregam currículo,
 * telefone e nome — leem pela chave de serviço, não pela anônima (o
 * schema revoga `select` de `anon` nessas duas). Mesmo builder falso do
 * mock acima, para as asserções de `tabelasConsultadas` continuarem
 * valendo sem duplicar a simulação.
 *
 * `temServico` alternável simula banco configurado mas sem
 * `SUPABASE_SERVICE_ROLE_KEY` — caso em que `clienteDeServico()` devolve
 * `null` mesmo com `isSupabaseConfigured` true.
 */
const servico = vi.hoisted(() => ({ temServico: true }));

vi.mock("@/lib/supabase/service", () => ({
  clienteDeServico: () =>
    servico.temServico
      ? {
          from: (tabela: string) => {
            tabelasConsultadas.push(tabela);
            ultimoBuilder = criarQueryBuilder(respostaAtual);
            return ultimoBuilder;
          },
        }
      : null,
}));

import {
  getCandidateProfile,
  getCompany,
  getCompanyApplications,
  getCompanyJobs,
  getJobById,
  getJobs,
  getProviderById,
  getProviders,
  getReviews,
  getVerificationQueue,
} from "@/lib/data";

// Nenhum describe além do que testa a chave ausente deve rodar sem ela.
afterEach(() => {
  servico.temServico = true;
});

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
    servico.temServico = true;
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

/**
 * Banco configurado sem `SUPABASE_SERVICE_ROLE_KEY` é configuração
 * quebrada, não motivo para mostrar currículo de exemplo como se fosse
 * real. `company_applications` e `verification_queue` leem pela chave de
 * serviço porque `anon` perde `select` nelas no schema — sem a chave,
 * a consulta precisa falhar, não cair no mock em silêncio.
 */
describe("chave de serviço ausente falha, não cai no mock", () => {
  beforeEach(() => {
    servico.temServico = false;
  });

  it("candidaturas da empresa falham sem a chave de serviço", async () => {
    await expect(getCompanyApplications("empresa-1")).rejects.toThrow(
      /chave de serviço/,
    );
  });

  it("fila de verificação falha sem a chave de serviço", async () => {
    await expect(getVerificationQueue()).rejects.toThrow(/chave de serviço/);
  });
});

/**
 * As colunas de id são `uuid`. Um id vindo da URL que não tenha essa forma
 * faz o Postgres recusar a comparação com 22P02 antes de olhar qualquer
 * linha — nenhum registro poderia corresponder.
 *
 * Custou duas respostas erradas seguidas para a mesma URL. Enquanto o
 * fallback silencioso existia, `/servicos/prv-joao-silva` devolvia um
 * perfil de mentira; ao removê-lo, passou a devolver página de erro com
 * HTTP 200, porque a exceção acontece depois de o shell ter sido
 * transmitido. A resposta certa sempre foi 404.
 */
describe("id sem forma de uuid é não-encontrado, não falha", () => {
  const ERRO_22P02 = {
    code: "22P02",
    message: 'invalid input syntax for type uuid: "prv-joao-silva"',
  };

  it("busca por id devolve null em vez de explodir", async () => {
    respostaAtual = { data: null, error: ERRO_22P02 };

    expect(await getJobById("prv-joao-silva")).toBeNull();
    expect(await getProviderById("prv-joao-silva")).toBeNull();
  });

  it("erro de banco de verdade continua virando exceção", async () => {
    respostaAtual = {
      data: null,
      error: { code: "08006", message: "conexão recusada" },
    };

    await expect(
      getProviderById("11111111-1111-4111-8111-000000000001"),
    ).rejects.toThrow(/conexão recusada/);
  });

  /** Sem `code`, o erro é desconhecido e não pode ser tratado como 404. */
  it("erro sem código não é confundido com id inválido", async () => {
    respostaAtual = { data: null, error: { message: "sem código" } };

    await expect(getJobById("qualquer")).rejects.toThrow(/sem código/);
  });
});

/**
 * Todo caminho que recebe id de fora precisa do mesmo desvio: id sem forma
 * de uuid é "não existe", não "servidor quebrado". Cada função aqui atende
 * uma URL onde o id chega da barra de endereços ou de um link antigo.
 */
describe("22P02 em cada caminho que recebe id de fora", () => {
  const ERRO_22P02 = {
    code: "22P02",
    message: 'invalid input syntax for type uuid: "nao-e-uuid"',
  };

  beforeEach(() => {
    respostaAtual = { data: null, error: ERRO_22P02 };
  });

  it("empresa inexistente devolve null", async () => {
    expect(await getCompany("nao-e-uuid")).toBeNull();
  });

  it("avaliações de id inválido devolvem lista vazia", async () => {
    expect(await getReviews("nao-e-uuid")).toEqual([]);
  });

  it("candidaturas de empresa inválida devolvem lista vazia", async () => {
    expect(await getCompanyApplications("nao-e-uuid")).toEqual([]);
  });

  /**
   * Eu tinha deixado esta de fora achando que o id vinha de sessão
   * autenticada. Não vinha: `/empresa` chamava `getDemoCompanyId()`, que
   * devolve "cmp-agro-norte". Com o banco ligado, a página inteira caía —
   * era o erro que o Luiz via ao abrir "Para empresas".
   *
   * A lição é sobre a suposição, não sobre a linha: presumi a origem do id
   * em vez de seguir a chamada até quem passa.
   */
  it("vagas da empresa também devolvem lista vazia", async () => {
    expect(await getCompanyJobs("nao-e-uuid")).toEqual([]);
  });
});

/**
 * O currículo mora em `perfis_candidato`, com nomes em português, e é lido
 * só pelo próprio dono. Fica fora de qualquer view pública de propósito:
 * nem todo mundo quer que o patrão atual descubra que está procurando
 * emprego, e isso pode custar o emprego que a pessoa ainda tem.
 */
describe("currículo do candidato", () => {
  it("traduz as colunas para o tipo da aplicação", async () => {
    respostaAtual = {
      data: {
        usuario_id: "u1",
        area_desejada: "Agronegócio",
        resumo: null,
        experiencias: [],
        formacao: "Ensino médio completo",
        habilidades: ["CNH categoria C"],
        curriculo_url: null,
        disponibilidade: "Imediata",
      },
      error: null,
    };

    expect(await getCandidateProfile("u1")).toEqual({
      profile_id: "u1",
      desired_area: "Agronegócio",
      experiences: [],
      education: "Ensino médio completo",
      skills: ["CNH categoria C"],
      resume_url: null,
      availability: "Imediata",
    });
  });

  /** Conta recém-criada ainda não tem currículo, e isso não é erro. */
  it("sem currículo devolve null", async () => {
    respostaAtual = { data: null, error: null };
    expect(await getCandidateProfile("u1")).toBeNull();
  });

  it("colunas nulas viram listas vazias, não undefined", async () => {
    respostaAtual = {
      data: {
        usuario_id: "u1",
        area_desejada: null,
        experiencias: null,
        formacao: null,
        habilidades: null,
        curriculo_url: null,
        disponibilidade: null,
      },
      error: null,
    };

    const p = await getCandidateProfile("u1");
    expect(p?.skills).toEqual([]);
    expect(p?.experiences).toEqual([]);
  });

  it("id sem forma de uuid é não-encontrado", async () => {
    respostaAtual = {
      data: null,
      error: { code: "22P02", message: "invalid input syntax for type uuid" },
    };
    expect(await getCandidateProfile("nao-e-uuid")).toBeNull();
  });

  it("erro de banco continua lançando", async () => {
    respostaAtual = {
      data: null,
      error: { code: "08006", message: "conexão recusada" },
    };
    await expect(getCandidateProfile("u1")).rejects.toThrow(/perfis_candidato/);
  });
});
