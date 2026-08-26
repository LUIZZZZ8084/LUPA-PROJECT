import { beforeEach, describe, expect, it, vi } from "vitest";

// `next/headers` só existe no runtime do Next; o cliente Supabase o importa.
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => null,
  getCurrentUser: async () => null,
}));

import {
  getCompanyApplications,
  getCompanyJobs,
  getCompanyStats,
  getHomeFeed,
  getJobById,
  getJobs,
  getMyApplications,
  getProviderById,
  getProviders,
  getRelatedJobs,
  getReviews,
  ratingBreakdown,
} from "@/lib/data";
import {
  DEMO_COMPANY_ID,
  MOCK_APPLICATIONS,
  MOCK_JOBS,
  MOCK_PROVIDERS,
  MOCK_REVIEWS,
} from "@/lib/mock-data";
import { repositorioVagas } from "@/server/vagas";

describe("getJobs", () => {
  it("devolve apenas vagas abertas", async () => {
    const jobs = await getJobs();
    expect(jobs.length).toBeGreaterThan(0);
    expect(jobs.every((j) => j.status === "aberta")).toBe(true);
  });

  it("ordena da mais recente para a mais antiga", async () => {
    const jobs = await getJobs();
    const datas = jobs.map((j) => +new Date(j.created_at));
    expect(datas).toEqual([...datas].sort((a, b) => b - a));
  });

  it("filtra por categoria", async () => {
    const jobs = await getJobs({ category: "Agronegócio" });
    expect(jobs.length).toBeGreaterThan(0);
    expect(jobs.every((j) => j.category === "Agronegócio")).toBe(true);
  });

  it("filtra por tipo de contrato", async () => {
    const jobs = await getJobs({ contract_type: "Estágio" });
    expect(jobs.every((j) => j.contract_type === "Estágio")).toBe(true);
  });

  it("busca por texto no título", async () => {
    const jobs = await getJobs({ q: "motorista" });
    expect(jobs.some((j) => /motorista/i.test(j.title))).toBe(true);
  });

  it("busca ignorando acento — quem digita no celular raramente acentua", async () => {
    const comAcento = await getJobs({ q: "mecânicas" });
    const semAcento = await getJobs({ q: "mecanicas" });
    expect(semAcento.map((j) => j.id)).toEqual(comAcento.map((j) => j.id));
  });

  it("busca ignorando maiúsculas", async () => {
    const a = await getJobs({ q: "OPERADOR" });
    const b = await getJobs({ q: "operador" });
    expect(a.map((j) => j.id)).toEqual(b.map((j) => j.id));
  });

  it("encontra pela empresa, não só pelo cargo", async () => {
    const jobs = await getJobs({ q: "Agro Norte" });
    expect(jobs.length).toBeGreaterThan(0);
    expect(jobs.every((j) => /agro norte/i.test(j.company.company_name))).toBe(
      true,
    );
  });

  it("devolve lista vazia sem resultado, em vez de quebrar", async () => {
    const jobs = await getJobs({ q: "cargo-que-nao-existe-xyz" });
    expect(jobs).toEqual([]);
  });

  it("respeita o filtro de cidade", async () => {
    expect(await getJobs({ city: "Sorriso" })).toEqual([]);
    expect((await getJobs({ city: "Sinop" })).length).toBeGreaterThan(0);
  });

  it("combina filtros de forma restritiva", async () => {
    const jobs = await getJobs({
      category: "Agronegócio",
      contract_type: "Estágio",
    });
    expect(
      jobs.every(
        (j) => j.category === "Agronegócio" && j.contract_type === "Estágio",
      ),
    ).toBe(true);
  });
});

/**
 * A tradução entre o mock e o repositório, ida e volta.
 *
 * Em demonstração a vaga sai de `MOCK_JOBS`, vira `Vaga` para entrar no
 * repositório e volta a `JobListing` para a tela. São dois mapas de campo
 * a campo, e campo trocado ali aparece como salário no lugar do bairro sem
 * quebrar nada — o tipo é o mesmo dos dois lados.
 */
describe("ida e volta pelo repositório de demonstração", () => {
  it("nenhum campo se perde nem troca de lugar", async () => {
    const original = MOCK_JOBS.find((j) => j.id === "job-operador-maquinas");
    const jobs = await getJobs();
    const depois = jobs.find((j) => j.id === "job-operador-maquinas");

    expect(original, "a vaga de referência sumiu do mock").toBeDefined();

    /*
     * `applicant_count` fica de fora: o mock declara um número de vitrine
     * e a volta recalcula a partir das candidaturas que existem de
     * verdade. Ver "15 candidatos" numa vaga com três currículos na tela
     * ao lado é o tipo de incoerência que quem está sendo apresentado ao
     * produto nota na hora.
     */
    const { applicant_count: _ignorado, ...esperado } = original as NonNullable<
      typeof original
    >;
    expect(depois).toMatchObject(esperado);
  });

  it("a contagem de candidatos vem das candidaturas, não do mock da vaga", async () => {
    const jobs = await getJobs();

    for (const job of jobs) {
      const esperado = MOCK_APPLICATIONS.filter(
        (a) => a.job_id === job.id,
      ).length;
      expect(job.applicant_count, job.id).toBe(esperado);
    }
  });
});

describe("getJobById", () => {
  it("encontra a vaga pelo id", async () => {
    const job = await getJobById("job-operador-maquinas");
    expect(job?.title).toContain("Operador de Máquinas");
  });

  it("devolve null para id inexistente", async () => {
    expect(await getJobById("nao-existe")).toBeNull();
  });
});

describe("getRelatedJobs", () => {
  it("não inclui a própria vaga", async () => {
    const job = (await getJobById("job-operador-maquinas"))!;
    const relacionadas = await getRelatedJobs(job);
    expect(relacionadas.some((r) => r.id === job.id)).toBe(false);
  });

  it("prioriza vagas da mesma empresa", async () => {
    const job = (await getJobById("job-operador-maquinas"))!;
    const relacionadas = await getRelatedJobs(job);
    expect(relacionadas[0]?.company_id).toBe(job.company_id);
  });

  it("respeita o limite pedido", async () => {
    const job = (await getJobById("job-operador-maquinas"))!;
    expect((await getRelatedJobs(job, 2)).length).toBeLessThanOrEqual(2);
  });
});

describe("getProviders", () => {
  it("coloca os verificados antes dos não verificados", async () => {
    const lista = await getProviders();
    const primeiroNaoVerificado = lista.findIndex((p) => !p.doc_verified);
    if (primeiroNaoVerificado === -1) return;
    expect(
      lista.slice(primeiroNaoVerificado).every((p) => !p.doc_verified),
    ).toBe(true);
  });

  it("filtra por categoria", async () => {
    const lista = await getProviders({ category: "eletricista" });
    expect(lista.length).toBeGreaterThan(0);
    expect(lista.every((p) => p.category.slug === "eletricista")).toBe(true);
  });

  it("respeita a nota mínima", async () => {
    const lista = await getProviders({ min_rating: 4.8 });
    expect(lista.every((p) => p.avg_rating >= 4.8)).toBe(true);
  });

  it("busca por bairro atendido, não só por nome", async () => {
    const lista = await getProviders({ q: "Menezes" });
    expect(
      lista.every((p) =>
        p.service_area.some((b) => b.toLowerCase().includes("menezes")),
      ),
    ).toBe(true);
  });
});

describe("getProviderById", () => {
  it("encontra o prestador", async () => {
    const p = await getProviderById("prv-joao-silva");
    expect(p?.full_name).toBe("João Silva");
  });

  it("devolve null para id inexistente", async () => {
    expect(await getProviderById("nao-existe")).toBeNull();
  });
});

describe("avaliações", () => {
  it("traz as avaliações do prestador, da mais recente para a mais antiga", async () => {
    const reviews = await getReviews("prv-joao-silva");
    expect(reviews.length).toBeGreaterThan(0);
    expect(reviews.every((r) => r.provider_id === "prv-joao-silva")).toBe(true);
    const datas = reviews.map((r) => +new Date(r.created_at));
    expect(datas).toEqual([...datas].sort((a, b) => b - a));
  });

  it("a distribuição soma o total de avaliações", () => {
    const dist = ratingBreakdown(MOCK_REVIEWS);
    const soma = Object.values(dist).reduce((a, b) => a + b, 0);
    expect(soma).toBe(MOCK_REVIEWS.length);
  });

  it("a distribuição sempre tem as cinco faixas, mesmo zeradas", () => {
    expect(Object.keys(ratingBreakdown([])).sort()).toEqual([
      "1",
      "2",
      "3",
      "4",
      "5",
    ]);
  });

  /**
   * Regressão: o perfil já mostrou "27 avaliações" com 3 na lista, e as
   * barras não fechavam. Nota e contagem precisam derivar das avaliações.
   */
  it("nota e contagem batem com as avaliações existentes", () => {
    for (const p of MOCK_PROVIDERS) {
      const suas = MOCK_REVIEWS.filter((r) => r.provider_id === p.profile_id);
      expect(p.review_count).toBe(suas.length);
      if (suas.length === 0) {
        expect(p.avg_rating).toBe(0);
        continue;
      }
      const media = suas.reduce((s, r) => s + r.rating, 0) / suas.length;
      expect(p.avg_rating).toBeCloseTo(Math.round(media * 10) / 10, 5);
    }
  });
});

describe("painel da empresa", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lista só as vagas da própria empresa", async () => {
    const jobs = await getCompanyJobs("cmp-agro-norte");
    expect(jobs.length).toBeGreaterThan(0);
    expect(jobs.every((j) => j.company_id === "cmp-agro-norte")).toBe(true);
  });

  it("lista só candidaturas das vagas da empresa", async () => {
    const jobIds = new Set(
      (await getCompanyJobs("cmp-agro-norte")).map((j) => j.id),
    );
    const apps = await getCompanyApplications("cmp-agro-norte");
    expect(apps.every((a) => jobIds.has(a.job_id))).toBe(true);
  });

  it("não vaza candidaturas de outra empresa", async () => {
    const apps = await getCompanyApplications("cmp-clinica-vida");
    const outras = await getCompanyApplications("cmp-agro-norte");
    const ids = new Set(outras.map((a) => a.id));
    expect(apps.some((a) => ids.has(a.id))).toBe(false);
  });

  it("as estatísticas refletem as vagas abertas", async () => {
    const jobs = await getCompanyJobs("cmp-agro-norte");
    const stats = await getCompanyStats("cmp-agro-norte");
    expect(stats.active_jobs).toBe(
      jobs.filter((j) => j.status === "aberta").length,
    );
  });
});

/**
 * O que ordena as vagas relacionadas.
 *
 * A pontuação é 2 para mesma empresa e 1 para mesma categoria. Os números
 * não são decorativos: uma vaga da mesma empresa tem que vir na frente de
 * uma vaga só da mesma categoria, porque quem está lendo uma vaga da Agro
 * Norte tende a querer as outras da Agro Norte. Com pesos iguais, a ordem
 * passaria a depender da ordem de chegada da lista.
 */
describe("pontuação das vagas relacionadas", () => {
  it("mesma empresa pesa mais que mesma categoria", async () => {
    const jobs = await getJobs();
    const real = jobs.find((j) => j.id === "job-operador-maquinas");
    if (!real) throw new Error("vaga de referência sumiu do mock");

    /*
     * Base montada à mão, e não uma vaga do mock: para separar os pesos é
     * preciso que exista, ao mesmo tempo, vaga da mesma empresa com outra
     * categoria e vaga de outra empresa com a mesma categoria. A Agro
     * Norte com categoria "Administrativo" produz exatamente esse par —
     * e não depende de o mock continuar tendo essa combinação por acaso.
     */
    const base = { ...real, category: "Administrativo" };

    const relacionadas = await getRelatedJobs(base, 20);

    const pontos = (j: (typeof relacionadas)[number]) =>
      (j.company_id === base.company_id ? 2 : 0) +
      (j.category === base.category ? 1 : 0);

    // A lista tem que estar em ordem não crescente de pontos.
    const sequencia = relacionadas.map(pontos);
    expect(sequencia).toEqual([...sequencia].sort((a, b) => b - a));

    // E precisa existir um par que distingue os pesos, senão o teste
    // passaria mesmo com 1 e 1.
    expect(sequencia).toContain(2);
    expect(sequencia).toContain(1);
    expect(sequencia.indexOf(2)).toBeLessThan(sequencia.indexOf(1));
  });

  it("só traz vagas da mesma cidade", async () => {
    const jobs = await getJobs();
    const base = jobs[0];
    for (const j of await getRelatedJobs(base, 20)) {
      expect(j.city).toBe(base.city);
    }
  });

  it("sem limite pedido, traz três", async () => {
    const jobs = await getJobs();
    const relacionadas = await getRelatedJobs(jobs[0]);
    expect(relacionadas).toHaveLength(3);
  });
});

describe("candidaturas em demonstração", () => {
  it("da mais recente para a mais antiga", async () => {
    const apps = await getCompanyApplications("cmp-agro-norte");
    const datas = apps.map((a) => +new Date(a.created_at));
    expect(datas).toEqual([...datas].sort((a, b) => b - a));
  });

  it("cada candidatura carrega o título da vaga a que se refere", async () => {
    const jobs = await getJobs();
    const porId = new Map(jobs.map((j) => [j.id, j.title]));

    for (const app of await getCompanyApplications("cmp-agro-norte")) {
      expect(app.job_title, app.id).toBe(porId.get(app.job_id));
    }
  });

  it("traz o candidato junto, senão o painel mostra linha sem nome", async () => {
    for (const app of await getCompanyApplications("cmp-agro-norte")) {
      expect(app.candidate.full_name, app.id).toBeTruthy();
    }
  });
});

describe("minhas candidaturas", () => {
  it("traz só as da própria pessoa, com a vaga e a empresa", async () => {
    const todas = await getCompanyApplications("cmp-agro-norte");
    const alguem = todas[0];

    const minhas = await getMyApplications(alguem.candidate_id);

    expect(minhas.length).toBeGreaterThan(0);
    expect(minhas.every((a) => a.candidate_id === alguem.candidate_id)).toBe(
      true,
    );

    const uma = minhas.find((a) => a.id === alguem.id);
    expect(uma?.job_title).toBe(alguem.job_title);
    // Sem o nome da empresa a tela diria só "Auxiliar de Produção", sem
    // dizer onde a pessoa se candidatou.
    expect(uma?.company_name).toBeTruthy();
    expect(uma?.company_name).not.toBe("Empresa");
  });

  it("quem não se candidatou a nada recebe lista vazia", async () => {
    expect(await getMyApplications("ninguem-com-esse-id")).toEqual([]);
  });
});

describe("estatísticas do painel", () => {
  it("conta só as vagas abertas como ativas", async () => {
    const jobs = await getCompanyJobs("cmp-agro-norte");
    const stats = await getCompanyStats("cmp-agro-norte");

    const abertas = jobs.filter((j) => j.status === "aberta").length;
    expect(stats.active_jobs).toBe(abertas);
    // Se contasse todas, a empresa acharia que tem mais vaga no ar do que
    // tem — e pararia de publicar achando que atingiu o limite do plano.
    expect(stats.active_jobs).toBeLessThanOrEqual(jobs.length);
  });

  it("soma os currículos de todas as vagas, abertas ou não", async () => {
    const jobs = await getCompanyJobs("cmp-agro-norte");
    const stats = await getCompanyStats("cmp-agro-norte");

    expect(stats.applications).toBe(
      jobs.reduce((soma, j) => soma + j.applicant_count, 0),
    );
    expect(stats.applications).toBeGreaterThan(0);
  });

  it("empresa sem vaga tem tudo zerado, e não quebra", async () => {
    expect(await getCompanyStats("cmp-que-nao-existe")).toEqual({
      active_jobs: 0,
      applications: 0,
    });
  });
});

describe("getHomeFeed", () => {
  /*
   * A home é a primeira tela, e depois da abertura para os 142 municípios
   * quatro vagas escolhidas só por data podem ser quatro vagas a 500km de
   * quem abriu — que é a leitura de "este app não é da minha cidade".
   *
   * A busca já ordenava por perto; a home tinha ficado de fora.
   */
  it("os destaques também vêm do mais perto para o mais longe", async () => {
    const daCapital = await getHomeFeed({ cidade: "Cuiabá", bairro: null });
    const deSinop = await getHomeFeed({ cidade: "Sinop", bairro: null });

    // O mock é de Sinop: visto de Sinop, a primeira é daqui.
    expect(deSinop.jobs[0].city).toBe("Sinop");

    /*
     * Visto de Cuiabá as mesmas vagas empatam no último degrau e a ordem
     * volta a ser por data. O que se afirma é que a origem muda o
     * resultado — não que uma ordem específica seja a certa.
     */
    expect(daCapital.jobs.map((j) => j.id)).not.toEqual(
      deSinop.jobs
        .map((j) => j.id)
        .slice()
        .reverse(),
    );
    expect(daCapital.totals).toEqual(deSinop.totals);
  });

  it("sem sessão, a home continua funcionando", async () => {
    const feed = await getHomeFeed();
    expect(feed.jobs.length).toBeGreaterThan(0);
  });

  it("limita os destaques a quatro de cada", async () => {
    const feed = await getHomeFeed();
    expect(feed.jobs.length).toBeLessThanOrEqual(4);
    expect(feed.providers.length).toBeLessThanOrEqual(4);
  });

  it("os totais refletem a base inteira, não só os destaques", async () => {
    const feed = await getHomeFeed();
    expect(feed.totals.jobs).toBe((await getJobs()).length);
    expect(feed.totals.providers).toBe((await getProviders()).length);
  });
});

/**
 * Ordenação por proximidade na camada de dados — Issue #79.
 *
 * A escada em si é conferida em `proximidade.test.ts`, sobre a função
 * pura. O que se cobra aqui é a ligação: que `getJobs` e `getProviders`
 * realmente aplicam o comparador, que ordenar não virou filtrar, e que sem
 * `perto` a ordem continua exatamente a de antes.
 *
 * Os dados de exemplo são todos de Sinop, então a vaga de outra cidade é
 * criada no repositório de demonstração — o mesmo caminho que a empresa
 * percorre ao publicar.
 */
describe("busca ordenada pelo mais perto", () => {
  const publicarEm = async (cidade: string, titulo: string) =>
    repositorioVagas().criar({
      empresaId: DEMO_COMPANY_ID,
      titulo,
      descricao: "Vaga criada por teste para conferir a ordenação.",
      categoria: "Logística e Transporte",
      cidade,
      tipoContrato: "CLT",
    });

  it("traz a cidade da pessoa antes da região, e a região antes do resto", async () => {
    await getJobs(); // semeia os dados de exemplo antes de criar os novos
    const cuiaba = await publicarEm("Cuiabá", "Vaga de Cuiabá");
    const claudia = await publicarEm("Cláudia", "Vaga de Cláudia");
    const sorriso = await publicarEm("Sorriso", "Vaga de Sorriso");

    const jobs = await getJobs({ perto: { cidade: "Sinop" } });
    const posicao = (id: string) => jobs.findIndex((j) => j.id === id);

    // Alguma vaga de Sinop precisa vir antes de todas as outras.
    expect(posicao(claudia.id)).toBeGreaterThan(0);
    expect(posicao(claudia.id)).toBeLessThan(posicao(sorriso.id));
    expect(posicao(sorriso.id)).toBeLessThan(posicao(cuiaba.id));
  });

  it("ordenar não é filtrar: nada sai da lista por estar longe", async () => {
    const semPerto = await getJobs();
    const comPerto = await getJobs({ perto: { cidade: "Cuiabá" } });

    expect(comPerto).toHaveLength(semPerto.length);
    expect(new Set(comPerto.map((j) => j.id))).toEqual(
      new Set(semPerto.map((j) => j.id)),
    );
  });

  it("sem `perto`, a ordem continua sendo a data — como antes da #79", async () => {
    const datas = (await getJobs()).map((j) => +new Date(j.created_at));
    expect(datas).toEqual([...datas].sort((a, b) => b - a));
  });

  it("dentro da mesma cidade, o desempate por data continua valendo", async () => {
    const jobs = await getJobs({ perto: { cidade: "Sinop" } });
    const datas = jobs
      .filter((j) => j.city === "Sinop")
      .map((j) => +new Date(j.created_at));

    expect(datas).toEqual([...datas].sort((a, b) => b - a));
  });

  it("o filtro de cidade continua restringindo, com `perto` junto", async () => {
    const jobs = await getJobs({
      city: "Cláudia",
      perto: { cidade: "Sinop" },
    });
    expect(jobs.length).toBeGreaterThan(0);
    expect(jobs.every((j) => j.city === "Cláudia")).toBe(true);
  });

  it("prestador: o desempate por nota sobrevive à proximidade", async () => {
    // Todos os prestadores de exemplo são de Sinop, então empatam no grau.
    const providers = await getProviders({ perto: { cidade: "Sinop" } });
    const semPerto = await getProviders();

    expect(providers.map((p) => p.profile_id)).toEqual(
      semPerto.map((p) => p.profile_id),
    );
  });
});
