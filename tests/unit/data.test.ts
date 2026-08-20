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
  getProviderById,
  getProviders,
  getRelatedJobs,
  getReviews,
  ratingBreakdown,
} from "@/lib/data";
import { MOCK_PROVIDERS, MOCK_REVIEWS } from "@/lib/mock-data";

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
    expect(
      jobs.every((j) => /agro norte/i.test(j.company.company_name)),
    ).toBe(true);
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

describe("getHomeFeed", () => {
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
