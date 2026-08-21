import "server-only";

import {
  DEMO_COMPANY_ID,
  MOCK_APPLICATIONS,
  MOCK_COMPANIES,
  MOCK_COMPANY_STATS,
  MOCK_JOBS,
  MOCK_PROVIDERS,
  MOCK_REVIEWS,
  MOCK_VERIFICATIONS,
  type VerificationRequest,
} from "./mock-data";
import { isSupabaseConfigured } from "./supabase/config";
import { createClient } from "./supabase/server";
import type {
  ApplicationWithCandidate,
  Company,
  JobFilters,
  JobListing,
  ProviderFilters,
  ProviderListing,
  Review,
} from "./types";

/**
 * Camada de acesso a dados.
 *
 * Cada função tenta o Supabase primeiro e cai para os dados de demonstração
 * quando o banco não está configurado. As consultas usam as views
 * `job_listings` e `provider_listings` (definidas em supabase/schema.sql),
 * que já resolvem os joins de empresa, categoria e verificação.
 */

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, ""); // remove acentos

const matches = (haystack: string[], q: string) =>
  haystack.some((h) => norm(h).includes(norm(q)));

/**
 * Traduz falha de consulta em exceção, em vez de silêncio.
 *
 * O padrão antigo era `if (!error && data) return data`, e o que vinha
 * depois era o dado de exemplo. Com o banco ligado, qualquer erro — chave
 * errada, rede, view ausente — servia mock como se fosse real, sem log e
 * sem aviso na tela. Uma integração quebrada ficou invisível por uma hora
 * exatamente assim: a página parecia funcionar.
 *
 * Não é só ruído de depuração. As telas mostram vaga e prestador para quem
 * está procurando emprego em Sinop; servir cadastro que não existe faz a
 * pessoa gastar crédito de celular atrás de uma vaga inventada. O aviso de
 * demonstração existe para esse caso, e o fallback silencioso o contorna.
 *
 * Erro em Server Component sobe para a fronteira de erro do Next e é
 * capturado pelo Sentry. Página de erro é honesta; vaga falsa não é.
 */
function falhaDeConsulta(origem: string, erro: { message: string }): Error {
  return new Error(`Consulta a "${origem}" falhou: ${erro.message}`);
}

/**
 * Id que não tem forma de uuid é "não encontrado", não falha de servidor.
 *
 * As colunas de id são `uuid`. Um id vindo da URL como `prv-joao-silva`
 * faz o Postgres recusar a comparação com 22P02 — "invalid text
 * representation" — antes de olhar qualquer linha. Nenhum registro poderia
 * corresponder, então a resposta certa é 404.
 *
 * Tratar isso como erro tem custo concreto: enquanto o fallback silencioso
 * existia, `/servicos/prv-joao-silva` respondia com um perfil de mentira;
 * ao removê-lo, passou a responder com página de erro e HTTP 200, porque a
 * exceção acontece depois de o shell já ter sido transmitido. Nenhum dos
 * dois é o que um id inexistente merece.
 */
function ehIdSemFormaDeUuid(erro: { code?: string }): boolean {
  return erro.code === "22P02";
}

/* ============================================================
   Vagas
   ============================================================ */

export async function getJobs(filters: JobFilters = {}): Promise<JobListing[]> {
  if (isSupabaseConfigured) {
    const supabase = await createClient();
    if (supabase) {
      let query = supabase
        .from("job_listings")
        .select("*")
        .eq("status", "aberta")
        .order("created_at", { ascending: false });

      if (filters.city) query = query.eq("city", filters.city);
      if (filters.category) query = query.eq("category", filters.category);
      if (filters.contract_type)
        query = query.eq("contract_type", filters.contract_type);
      if (filters.q)
        query = query.or(
          `title.ilike.%${filters.q}%,description.ilike.%${filters.q}%`,
        );

      const { data, error } = await query;
      if (error) throw falhaDeConsulta("job_listings", error);
      return (data ?? []) as unknown as JobListing[];
    }
  }

  return MOCK_JOBS.filter((job) => {
    if (job.status !== "aberta") return false;
    if (filters.city && job.city !== filters.city) return false;
    if (filters.category && job.category !== filters.category) return false;
    if (filters.contract_type && job.contract_type !== filters.contract_type)
      return false;
    if (
      filters.q &&
      !matches(
        [
          job.title,
          job.description,
          job.company.company_name,
          job.category ?? "",
        ],
        filters.q,
      )
    )
      return false;
    return true;
  }).sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
}

export async function getJobById(id: string): Promise<JobListing | null> {
  if (isSupabaseConfigured) {
    const supabase = await createClient();
    if (supabase) {
      const { data, error } = await supabase
        .from("job_listings")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) {
        if (ehIdSemFormaDeUuid(error)) return null;
        throw falhaDeConsulta("job_listings", error);
      }
      return (data as unknown as JobListing) ?? null;
    }
  }
  return MOCK_JOBS.find((j) => j.id === id) ?? null;
}

/** Outras vagas abertas da mesma empresa, para o rodapé do detalhe. */
export async function getRelatedJobs(
  job: JobListing,
  limit = 3,
): Promise<JobListing[]> {
  const all = await getJobs({ city: job.city });
  return all
    .filter((j) => j.id !== job.id)
    .sort((a, b) => {
      const score = (x: JobListing) =>
        (x.company_id === job.company_id ? 2 : 0) +
        (x.category === job.category ? 1 : 0);
      return score(b) - score(a);
    })
    .slice(0, limit);
}

/* ============================================================
   Prestadores de serviço
   ============================================================ */

export async function getProviders(
  filters: ProviderFilters = {},
): Promise<ProviderListing[]> {
  if (isSupabaseConfigured) {
    const supabase = await createClient();
    if (supabase) {
      let query = supabase
        .from("provider_listings")
        .select("*")
        .order("avg_rating", { ascending: false });

      if (filters.city) query = query.eq("city", filters.city);
      if (filters.category) query = query.eq("category_slug", filters.category);
      if (filters.min_rating)
        query = query.gte("avg_rating", filters.min_rating);
      if (filters.q)
        query = query.or(
          `full_name.ilike.%${filters.q}%,description.ilike.%${filters.q}%`,
        );

      const { data, error } = await query;
      if (error) throw falhaDeConsulta("provider_listings", error);
      return (data ?? []) as unknown as ProviderListing[];
    }
  }

  return MOCK_PROVIDERS.filter((p) => {
    if (filters.city && p.city !== filters.city) return false;
    if (filters.category && p.category.slug !== filters.category) return false;
    if (filters.min_rating && p.avg_rating < filters.min_rating) return false;
    if (
      filters.q &&
      !matches(
        [p.full_name, p.description ?? "", p.category.name, ...p.service_area],
        filters.q,
      )
    )
      return false;
    return true;
  }).sort((a, b) => {
    // Verificados primeiro, depois nota, depois volume de avaliações.
    if (a.doc_verified !== b.doc_verified) return a.doc_verified ? -1 : 1;
    if (b.avg_rating !== a.avg_rating) return b.avg_rating - a.avg_rating;
    return b.review_count - a.review_count;
  });
}

export async function getProviderById(
  id: string,
): Promise<ProviderListing | null> {
  if (isSupabaseConfigured) {
    const supabase = await createClient();
    if (supabase) {
      const { data, error } = await supabase
        .from("provider_listings")
        .select("*")
        .eq("profile_id", id)
        .maybeSingle();
      if (error) {
        if (ehIdSemFormaDeUuid(error)) return null;
        throw falhaDeConsulta("provider_listings", error);
      }
      return (data as unknown as ProviderListing) ?? null;
    }
  }
  return MOCK_PROVIDERS.find((p) => p.profile_id === id) ?? null;
}

export async function getReviews(providerId: string): Promise<Review[]> {
  if (isSupabaseConfigured) {
    const supabase = await createClient();
    if (supabase) {
      const { data, error } = await supabase
        .from("avaliacoes")
        .select("id, prestador_id, nome_avaliador, nota, comentario, criado_em")
        .eq("prestador_id", providerId)
        .order("criado_em", { ascending: false });
      if (error) {
        if (ehIdSemFormaDeUuid(error)) return [];
        throw falhaDeConsulta("avaliacoes", error);
      }

      // A tabela usa nomes em português; o tipo da aplicação, em inglês.
      return (data ?? []).map((linha) => ({
        id: String(linha.id),
        provider_id: String(linha.prestador_id),
        reviewer_name: String(linha.nome_avaliador),
        rating: Number(linha.nota),
        comment: (linha.comentario as string | null) ?? null,
        created_at: String(linha.criado_em),
      }));
    }
  }
  return MOCK_REVIEWS.filter((r) => r.provider_id === providerId).sort(
    (a, b) => +new Date(b.created_at) - +new Date(a.created_at),
  );
}

/** Distribuição de notas 5→1, usada na barra do perfil do prestador. */
export function ratingBreakdown(reviews: Review[]): Record<number, number> {
  const out: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  for (const r of reviews) out[r.rating] = (out[r.rating] ?? 0) + 1;
  return out;
}

/* ============================================================
   Empresa
   ============================================================ */

export async function getCompany(id: string): Promise<Company | null> {
  if (isSupabaseConfigured) {
    const supabase = await createClient();
    if (supabase) {
      const { data, error } = await supabase
        .from("perfis_empresa")
        .select("*")
        .eq("profile_id", id)
        .maybeSingle();
      if (error) {
        if (ehIdSemFormaDeUuid(error)) return null;
        throw falhaDeConsulta("perfis_empresa", error);
      }
      return (data as Company) ?? null;
    }
  }
  return MOCK_COMPANIES.find((c) => c.profile_id === id) ?? null;
}

export async function getCompanyJobs(companyId: string): Promise<JobListing[]> {
  if (isSupabaseConfigured) {
    const supabase = await createClient();
    if (supabase) {
      const { data, error } = await supabase
        .from("job_listings")
        .select("*")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });
      if (error) throw falhaDeConsulta("job_listings", error);
      return (data ?? []) as unknown as JobListing[];
    }
  }
  return MOCK_JOBS.filter((j) => j.company_id === companyId).sort(
    (a, b) => +new Date(b.created_at) - +new Date(a.created_at),
  );
}

export async function getCompanyApplications(
  companyId: string,
): Promise<ApplicationWithCandidate[]> {
  if (isSupabaseConfigured) {
    const supabase = await createClient();
    if (supabase) {
      const { data, error } = await supabase
        .from("company_applications")
        .select("*")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });
      if (error) {
        if (ehIdSemFormaDeUuid(error)) return [];
        throw falhaDeConsulta("company_applications", error);
      }
      return (data ?? []) as unknown as ApplicationWithCandidate[];
    }
  }
  const jobIds = new Set(
    MOCK_JOBS.filter((j) => j.company_id === companyId).map((j) => j.id),
  );
  return MOCK_APPLICATIONS.filter((a) => jobIds.has(a.job_id)).sort(
    (a, b) => +new Date(b.created_at) - +new Date(a.created_at),
  );
}

export async function getCompanyStats(companyId: string) {
  const jobs = await getCompanyJobs(companyId);
  const open = jobs.filter((j) => j.status === "aberta");
  return {
    active_jobs: open.length,
    applications: jobs.reduce((sum, j) => sum + j.applicant_count, 0),
    views: MOCK_COMPANY_STATS.views,
  };
}

/** Empresa usada no painel enquanto não há autenticação real. */
export function getDemoCompanyId(): string {
  return DEMO_COMPANY_ID;
}

/* ============================================================
   Admin
   ============================================================ */

export async function getVerificationQueue(): Promise<VerificationRequest[]> {
  if (isSupabaseConfigured) {
    const supabase = await createClient();
    if (supabase) {
      const { data, error } = await supabase
        .from("verification_queue")
        .select("*")
        .eq("status", "em_analise")
        .order("submitted_at", { ascending: true });
      if (error) throw falhaDeConsulta("verification_queue", error);
      return (data ?? []) as unknown as VerificationRequest[];
    }
  }
  return MOCK_VERIFICATIONS.filter((v) => v.status === "em_analise");
}

/* ============================================================
   Home
   ============================================================ */

export async function getHomeFeed() {
  const [jobs, providers] = await Promise.all([getJobs(), getProviders()]);
  return {
    jobs: jobs.slice(0, 4),
    providers: providers.slice(0, 4),
    totals: { jobs: jobs.length, providers: providers.length },
  };
}
