import "server-only";

import {
  RepositorioCandidaturasMemoria,
  repositorioCandidaturas,
} from "@/server/candidaturas";
import type { Candidatura } from "@/server/candidaturas/tipos";
import { repositorioUsuarios } from "@/server/repositories";
import { RepositorioVagasMemoria, repositorioVagas } from "@/server/vagas";
import type { Vaga } from "@/server/vagas/tipos";
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
import { clienteDeServico } from "./supabase/service";
import type {
  ApplicationWithCandidate,
  CltProfile,
  Company,
  JobFilters,
  JobListing,
  MyApplication,
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
 * Banco ligado sem `SUPABASE_SERVICE_ROLE_KEY` é configuração quebrada,
 * não motivo para mostrar dado de exemplo como se fosse real. Usada pelas
 * consultas que só podem ler pela chave de serviço — `anon` perde
 * `select` nessas views no schema, por carregarem currículo, telefone ou
 * métrica administrativa.
 */
function falhaDeChaveDeServico(origem: string): Error {
  return new Error(
    `Consulta a "${origem}" falhou: chave de serviço não configurada.`,
  );
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

/**
 * Converte o dado de exemplo para o formato interno do repositório de
 * vagas, e vice-versa.
 *
 * O repositório de vagas em memória é a fonte da verdade do modo
 * demonstração: sem isto, uma vaga publicada, editada ou encerrada pelo
 * painel nunca apareceria na busca pública nem no próprio painel, porque
 * os dois liam o array estático de `mock-data.ts` direto.
 */
function vagaDoMock(job: JobListing): Vaga {
  return {
    id: job.id,
    empresaId: job.company_id,
    titulo: job.title,
    descricao: job.description,
    categoria: job.category,
    cidade: job.city,
    bairro: job.neighborhood,
    tipoContrato: job.contract_type,
    salarioMin: job.salary_min,
    salarioMax: job.salary_max,
    status: job.status,
    criadoEm: job.created_at,
  };
}

function jobListingDaVaga(vaga: Vaga): JobListing {
  const empresa = MOCK_COMPANIES.find((c) => c.profile_id === vaga.empresaId);
  return {
    id: vaga.id,
    company_id: vaga.empresaId,
    title: vaga.titulo,
    description: vaga.descricao,
    category: vaga.categoria,
    city: vaga.cidade,
    neighborhood: vaga.bairro,
    contract_type: vaga.tipoContrato as JobListing["contract_type"],
    salary_min: vaga.salarioMin,
    salary_max: vaga.salarioMax,
    status: vaga.status,
    created_at: vaga.criadoEm,
    company: {
      company_name: empresa?.company_name ?? "Empresa",
      logo_url: empresa?.logo_url ?? null,
      doc_verified: empresa?.doc_verified ?? false,
    },
    applicant_count: MOCK_APPLICATIONS.filter((a) => a.job_id === vaga.id)
      .length,
  };
}

async function jobsEmDemonstracao(): Promise<JobListing[]> {
  const repo = repositorioVagas();
  if (repo instanceof RepositorioVagasMemoria) {
    repo.semear(MOCK_JOBS.map(vagaDoMock));
  }
  return (await repo.listar()).map(jobListingDaVaga);
}

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

  const jobs = await jobsEmDemonstracao();
  return jobs
    .filter((job) => {
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
    })
    .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
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
  const jobs = await jobsEmDemonstracao();
  return jobs.find((j) => j.id === id) ?? null;
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
        .select("usuario_id, razao_social, cnpj, logo_url, plano")
        .eq("usuario_id", id)
        .maybeSingle();
      if (error) {
        if (ehIdSemFormaDeUuid(error)) return null;
        throw falhaDeConsulta("perfis_empresa", error);
      }
      if (!data) return null;

      // A tabela usa nomes em português; o tipo da aplicação, em inglês.
      // O cast direto que existia aqui devolvia um objeto com as chaves
      // erradas: a tela lia `company_name` de um objeto que só tinha
      // `razao_social`, e mostrava vazio sem erro nenhum.
      return {
        profile_id: String(data.usuario_id),
        company_name: String(data.razao_social),
        cnpj: (data.cnpj as string | null) ?? null,
        logo_url: (data.logo_url as string | null) ?? null,
        plan: data.plano as Company["plan"],
      };
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
      if (error) {
        if (ehIdSemFormaDeUuid(error)) return [];
        throw falhaDeConsulta("job_listings", error);
      }
      return (data ?? []) as unknown as JobListing[];
    }
  }
  const jobs = await jobsEmDemonstracao();
  return jobs
    .filter((j) => j.company_id === companyId)
    .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
}

/* ============================================================
   Candidaturas
   ============================================================ */

/**
 * Converte candidatura + informação de candidato para o formato interno
 * do repositório, e vice-versa — mesmo motivo do par em vagas: o
 * repositório em memória é a fonte da verdade do modo demonstração, para
 * que mover de estágio pelo painel valha tanto ali quanto no perfil de
 * quem se candidatou.
 */
function candidaturaDoMock(app: ApplicationWithCandidate): Candidatura {
  return {
    id: app.id,
    vagaId: app.job_id,
    candidatoId: app.candidate_id,
    status: app.status,
    criadoEm: app.created_at,
  };
}

/**
 * O candidato de uma candidatura de exemplo não existe em nenhum
 * repositório — é só o objeto embutido em `mock-data.ts`. Já quem se
 * candidatou de verdade na demonstração é uma conta criada em memória,
 * com perfil próprio. Tenta o repositório de usuários primeiro; sem
 * achar, cai para o candidato de exemplo com o mesmo id.
 */
async function candidatoParaDemo(
  candidatoId: string,
): Promise<ApplicationWithCandidate["candidate"] | null> {
  const usuarios = repositorioUsuarios();
  const usuario = await usuarios.porId(candidatoId);
  if (usuario) {
    const perfil = await usuarios.perfilCandidato(candidatoId);
    return {
      full_name: usuario.nomeCompleto,
      avatar_url: usuario.avatarUrl,
      neighborhood: usuario.bairro,
      desired_area: perfil?.areaDesejada ?? null,
      resume_url: perfil?.curriculoUrl ?? null,
    };
  }
  return (
    MOCK_APPLICATIONS.find((a) => a.candidate_id === candidatoId)?.candidate ??
    null
  );
}

async function applicationsEmDemonstracao(): Promise<
  ApplicationWithCandidate[]
> {
  const repo = repositorioCandidaturas();
  if (repo instanceof RepositorioCandidaturasMemoria) {
    repo.semear(MOCK_APPLICATIONS.map(candidaturaDoMock));
  }

  const [candidaturas, jobs] = await Promise.all([
    repo.listar(),
    jobsEmDemonstracao(),
  ]);
  const jobsPorId = new Map(jobs.map((j) => [j.id, j]));

  const resultado: ApplicationWithCandidate[] = [];
  for (const c of candidaturas) {
    const job = jobsPorId.get(c.vagaId);
    if (!job) continue;
    const candidate = await candidatoParaDemo(c.candidatoId);
    if (!candidate) continue;

    resultado.push({
      id: c.id,
      job_id: c.vagaId,
      candidate_id: c.candidatoId,
      status: c.status,
      created_at: c.criadoEm,
      job_title: job.title,
      candidate,
    });
  }
  return resultado.sort(
    (a, b) => +new Date(b.created_at) - +new Date(a.created_at),
  );
}

export async function getCompanyApplications(
  companyId: string,
): Promise<ApplicationWithCandidate[]> {
  if (isSupabaseConfigured) {
    /*
     * Chave de serviço, não a anônima: `company_applications` carrega
     * currículo e telefone de candidato. `anon` perde o `select` nessa
     * view no schema — ler com ela aqui devolveria "sem permissão" em
     * vez de dado de verdade.
     */
    const supabase = clienteDeServico();
    if (!supabase) throw falhaDeChaveDeServico("company_applications");
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
  const [jobs, applications] = await Promise.all([
    jobsEmDemonstracao(),
    applicationsEmDemonstracao(),
  ]);
  const jobIds = new Set(
    jobs.filter((j) => j.company_id === companyId).map((j) => j.id),
  );
  return applications.filter((a) => jobIds.has(a.job_id));
}

/** Candidaturas de quem se candidatou — para "Minhas candidaturas" no perfil. */
export async function getMyApplications(
  candidateId: string,
): Promise<MyApplication[]> {
  if (isSupabaseConfigured) {
    // Mesma razão de company_applications: candidate_applications também
    // não é pública, e anon perde select nela no schema.
    const supabase = clienteDeServico();
    if (!supabase) throw falhaDeChaveDeServico("candidate_applications");
    const { data, error } = await supabase
      .from("candidate_applications")
      .select("*")
      .eq("candidate_id", candidateId)
      .order("created_at", { ascending: false });
    if (error) {
      if (ehIdSemFormaDeUuid(error)) return [];
      throw falhaDeConsulta("candidate_applications", error);
    }
    return (data ?? []) as unknown as MyApplication[];
  }

  const [jobs, applications] = await Promise.all([
    jobsEmDemonstracao(),
    applicationsEmDemonstracao(),
  ]);
  const jobsPorId = new Map(jobs.map((j) => [j.id, j]));

  return applications
    .filter((a) => a.candidate_id === candidateId)
    .map((a) => ({
      id: a.id,
      job_id: a.job_id,
      candidate_id: a.candidate_id,
      status: a.status,
      created_at: a.created_at,
      job_title: a.job_title,
      company_name: jobsPorId.get(a.job_id)?.company.company_name ?? "Empresa",
    }));
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

/**
 * De qual empresa o painel fala.
 *
 * Com o banco ligado, é sempre a da sessão: `perfis_empresa.usuario_id` é
 * a chave, então o id de quem entrou já é o id da empresa. O painel estava
 * preso a `DEMO_COMPANY_ID` — "cmp-agro-norte" — e por isso mostrava a
 * mesma empresa fictícia para todo mundo. Com o Supabase ligado esse id
 * nem tem forma de uuid, e a página inteira caía.
 *
 * Em demonstração o id continua sendo o fixo: a conta criada em memória
 * não corresponde a nenhuma empresa de exemplo, e usar o id da sessão
 * deixaria o painel vazio justamente quando ele serve para mostrar o
 * produto.
 */
export function empresaDoPainel(usuarioId: string | null): string {
  if (isSupabaseConfigured && usuarioId) return usuarioId;
  return DEMO_COMPANY_ID;
}

/* ============================================================
   Perfil de quem está logado
   ============================================================ */

/**
 * Currículo de um candidato.
 *
 * Fica fora de qualquer view pública de propósito: nem todo mundo quer que
 * o patrão atual descubra que está procurando emprego, e essa informação
 * pode custar o emprego que a pessoa ainda tem. Só o próprio dono lê, pela
 * chave de serviço, na tela do perfil.
 */
export async function getCandidateProfile(
  usuarioId: string,
): Promise<CltProfile | null> {
  if (isSupabaseConfigured) {
    const supabase = await createClient();
    if (supabase) {
      const { data, error } = await supabase
        .from("perfis_candidato")
        .select(
          "usuario_id, area_desejada, resumo, experiencias, formacao, habilidades, curriculo_url, disponibilidade",
        )
        .eq("usuario_id", usuarioId)
        .maybeSingle();
      if (error) {
        if (ehIdSemFormaDeUuid(error)) return null;
        throw falhaDeConsulta("perfis_candidato", error);
      }
      if (!data) return null;

      // A tabela usa nomes em português; o tipo da aplicação, em inglês.
      return {
        profile_id: String(data.usuario_id),
        desired_area: (data.area_desejada as string | null) ?? null,
        experiences: (data.experiencias as CltProfile["experiences"]) ?? [],
        education: (data.formacao as string | null) ?? null,
        skills: (data.habilidades as string[] | null) ?? [],
        resume_url: (data.curriculo_url as string | null) ?? null,
        availability: (data.disponibilidade as string | null) ?? null,
      };
    }
  }

  /*
   * Em demonstração não há currículo para devolver: o repositório de
   * memória guarda o perfil, mas fora do contrato compartilhado, e
   * `src/lib` não pode importar de `src/server` — o contrato de
   * arquitetura barra, e com razão: seria a camada de dados dependendo da
   * de regra de negócio.
   *
   * A tela trata nulo como "ainda não preenchido", que é o mesmo estado de
   * quem acabou de criar conta com o banco ligado.
   */
  return null;
}

/* ============================================================
   Admin
   ============================================================ */

export async function getVerificationQueue(): Promise<VerificationRequest[]> {
  if (isSupabaseConfigured) {
    // Chave de serviço: `verification_queue` traz nome e telefone de quem
    // pediu verificação. `anon` perde o `select` nessa view no schema.
    const supabase = clienteDeServico();
    if (!supabase) throw falhaDeChaveDeServico("verification_queue");
    const { data, error } = await supabase
      .from("verification_queue")
      .select("*")
      .eq("status", "em_analise")
      .order("submitted_at", { ascending: true });
    if (error) throw falhaDeConsulta("verification_queue", error);
    return (data ?? []) as unknown as VerificationRequest[];
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
