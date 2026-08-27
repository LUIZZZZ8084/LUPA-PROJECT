/**
 * Tipos do domínio Lupa — espelham o schema em supabase/schema.sql.
 * Mantenha os dois em sincronia ao alterar tabelas.
 *
 * Este arquivo está no `ignore` do knip de propósito: ele documenta o
 * schema inteiro, então alguns tipos ainda não têm consumidor no código —
 * `CltProfile`, por exemplo, existe porque a tabela `clt_profiles` existe.
 * Apagá-los deixaria o espelho incompleto.
 */

import type { Origem } from "./proximidade";

export type Role = "candidato_clt" | "prestador_servico" | "empresa";

export type VerificationStatus =
  | "pendente"
  | "em_analise"
  | "aprovado"
  | "reprovado";

export type ApplicationStatus =
  | "enviada"
  | "visualizada"
  | "entrevista"
  | "aprovada"
  | "rejeitada";

export type JobStatus = "aberta" | "fechada";

export type ContractType =
  | "CLT"
  | "Estágio"
  | "Temporário"
  | "Freelance"
  | "Jovem Aprendiz";

export type CompanyPlan = "trial" | "mensal";

export interface Profile {
  id: string;
  full_name: string;
  phone: string;
  role: Role;
  city: string;
  neighborhood: string | null;
  avatar_url: string | null;
  phone_verified: boolean;
  doc_verified: boolean;
  verification_status: VerificationStatus;
  created_at: string;
}

export interface CltProfile {
  profile_id: string;
  desired_area: string | null;
  experiences: Experience[];
  education: string | null;
  skills: string[];
  resume_url: string | null;
  availability: string | null;
}

export interface Experience {
  role: string;
  company: string;
  period: string;
  description?: string;
}

export interface ServiceCategory {
  id: number;
  slug: string;
  name: string;
}

export interface ProviderProfile {
  profile_id: string;
  category_id: number;
  description: string | null;
  starting_price: number | null;
  years_experience: number | null;
  service_area: string[];
  photo_urls: string[];
  avg_rating: number;
  review_count: number;
}

export interface Company {
  profile_id: string;
  company_name: string;
  cnpj: string | null;
  logo_url: string | null;
  plan: CompanyPlan;
}

export interface Job {
  id: string;
  company_id: string;
  title: string;
  description: string;
  category: string | null;
  city: string;
  neighborhood: string | null;
  /** Rua, número, ponto de referência — texto livre, sem geocodificação.
   * Informativo: não entra no ranking de proximidade, que usa só bairro
   * e cidade. `null` em vaga publicada antes deste campo existir. */
  address: string | null;
  contract_type: ContractType | null;
  salary_min: number | null;
  salary_max: number | null;
  /** O que a vaga pede. Vazio quando a empresa não declarou — aí o
   * casamento com o candidato lê o título e a descrição. */
  skills: string[];
  status: JobStatus;
  created_at: string;
}

export interface Application {
  id: string;
  job_id: string;
  candidate_id: string;
  status: ApplicationStatus;
  created_at: string;
}

export interface Review {
  id: string;
  provider_id: string;
  reviewer_name: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

/* ---------- Views compostas usadas pela UI ---------- */

/** Vaga já com os dados da empresa embutidos, como aparece nos cards. */
export interface JobListing extends Job {
  company: Pick<Company, "company_name" | "logo_url"> & {
    doc_verified: boolean;
  };
  applicant_count: number;
}

/** Prestador com nome, verificação e categoria resolvidos. */
export interface ProviderListing extends ProviderProfile {
  full_name: string;
  phone: string;
  city: string;
  neighborhood: string | null;
  avatar_url: string | null;
  phone_verified: boolean;
  doc_verified: boolean;
  category: ServiceCategory;
}

/** Candidatura vista pelo painel da empresa. */
export interface ApplicationWithCandidate extends Application {
  /*
   * O candidato, como a empresa dona da vaga o vê.
   *
   * Contato e currículo entram aqui porque candidatura sem contato não
   * vira entrevista. O que delimita o acesso não é o tipo: é a consulta,
   * que filtra sempre pela empresa da sessão, mais o `revoke` da view
   * para a chave anônima. Este objeto nunca chega a uma tela pública.
   */
  candidate: Pick<Profile, "full_name" | "avatar_url" | "neighborhood"> & {
    city: string | null;
    email: string | null;
    phone: string | null;
    desired_area: string | null;
    availability: string | null;
    summary: string | null;
    experiences: Experience[];
    education: string | null;
    skills: string[];
    resume_url: string | null;
  };
  job_title: string;
}

/** A mesma candidatura, vista por quem se candidatou — sem currículo alheio. */
export interface MyApplication extends Application {
  job_title: string;
  company_name: string;
}

/* ---------- Filtros de busca ---------- */

/**
 * `perto` não filtra nada: decide só a ordem, pondo o mais perto de quem
 * está olhando em primeiro. Anda junto dos filtros porque atravessa a mesma
 * consulta, mas a diferença importa — filtro esconde, proximidade reordena.
 *
 * A escada e o porquê dela estão em `src/lib/proximidade.ts`.
 */

export interface JobFilters {
  city?: string;
  perto?: Origem;
  category?: string;
  contract_type?: string;
  q?: string;
}

export interface ProviderFilters {
  city?: string;
  perto?: Origem;
  category?: string;
  /** Nota mínima, ex.: 4 mostra só quem tem 4,0 ou mais. */
  min_rating?: number;
  q?: string;
}
