-- ============================================================================
-- LUPA — schema Postgres (Supabase)
--
-- Aplique no SQL Editor do projeto Supabase, ou via CLI:
--   supabase db push
--
-- Multi-cidade desde o V0: toda entidade relevante tem `city`. A UI abre
-- apenas Sinop, mas abrir outra cidade não exige migração.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ============================================================================
-- 1. Perfis
-- ============================================================================

create type user_role as enum ('candidato_clt', 'prestador_servico', 'empresa');
create type verification_status as enum ('pendente', 'em_analise', 'aprovado', 'reprovado');
create type job_status as enum ('aberta', 'fechada');
create type application_status as enum ('enviada', 'visualizada', 'entrevista', 'aprovada', 'rejeitada');
create type company_plan as enum ('trial', 'mensal');

create table profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  full_name           text not null,
  phone               text not null,
  role                user_role not null,
  city                text not null default 'Sinop',
  neighborhood        text,
  avatar_url          text,
  phone_verified      boolean not null default false,
  doc_verified        boolean not null default false,
  verification_status verification_status not null default 'pendente',
  created_at          timestamptz not null default now()
);

create index profiles_city_role_idx on profiles (city, role);

-- Cria o perfil automaticamente a partir dos metadados do signUp.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone, role, city, neighborhood)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', 'Sem nome'),
    coalesce(new.raw_user_meta_data ->> 'phone', ''),
    coalesce((new.raw_user_meta_data ->> 'role')::user_role, 'candidato_clt'),
    coalesce(new.raw_user_meta_data ->> 'city', 'Sinop'),
    new.raw_user_meta_data ->> 'neighborhood'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============================================================================
-- 2. Perfis por papel
-- ============================================================================

create table clt_profiles (
  profile_id   uuid primary key references profiles(id) on delete cascade,
  desired_area text,
  experiences  jsonb not null default '[]',
  education    text,
  skills       text[] not null default '{}',
  resume_url   text,
  availability text
);

create table service_categories (
  id   serial primary key,
  slug text not null unique,
  name text not null unique
);

insert into service_categories (id, slug, name) values
  (1, 'eletricista', 'Eletricista'),
  (2, 'diarista',    'Diarista'),
  (3, 'pintor',      'Pintor'),
  (4, 'encanador',   'Encanador'),
  (5, 'pedreiro',    'Pedreiro'),
  (6, 'jardineiro',  'Jardineiro'),
  (7, 'cuidador',    'Cuidador(a)');

select setval('service_categories_id_seq', (select max(id) from service_categories));

create table provider_profiles (
  profile_id       uuid primary key references profiles(id) on delete cascade,
  category_id      int references service_categories(id),
  description      text,
  starting_price   numeric(10,2),
  years_experience int,
  service_area     text[] not null default '{}',
  photo_urls       text[] not null default '{}',
  -- Denormalizados e mantidos pelo trigger em `reviews`: a busca precisa
  -- ordenar por nota sem agregar a cada consulta.
  avg_rating       numeric(2,1) not null default 0,
  review_count     int not null default 0
);

create index provider_profiles_category_idx on provider_profiles (category_id);
create index provider_profiles_rating_idx on provider_profiles (avg_rating desc);

create table companies (
  profile_id   uuid primary key references profiles(id) on delete cascade,
  company_name text not null,
  cnpj         text unique,
  logo_url     text,
  plan         company_plan not null default 'trial'
);

-- ============================================================================
-- 3. Vagas e candidaturas
-- ============================================================================

create table jobs (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references companies(profile_id) on delete cascade,
  title         text not null,
  description   text not null,
  category      text,
  city          text not null default 'Sinop',
  neighborhood  text,
  contract_type text,
  salary_min    numeric(10,2),
  salary_max    numeric(10,2),
  status        job_status not null default 'aberta',
  view_count    int not null default 0,
  created_at    timestamptz not null default now()
);

create index jobs_city_status_idx on jobs (city, status, created_at desc);
create index jobs_category_idx on jobs (category);
create index jobs_company_idx on jobs (company_id);

-- Busca textual em português, para o campo de busca livre.
create index jobs_search_idx on jobs
  using gin (to_tsvector('portuguese', title || ' ' || description));

create table applications (
  id           uuid primary key default gen_random_uuid(),
  job_id       uuid not null references jobs(id) on delete cascade,
  candidate_id uuid not null references profiles(id) on delete cascade,
  status       application_status not null default 'enviada',
  created_at   timestamptz not null default now(),
  unique (job_id, candidate_id)
);

create index applications_job_idx on applications (job_id);
create index applications_candidate_idx on applications (candidate_id);

-- ============================================================================
-- 4. Avaliações
-- ============================================================================

create table reviews (
  id            uuid primary key default gen_random_uuid(),
  provider_id   uuid not null references profiles(id) on delete cascade,
  reviewer_name text not null,
  rating        int not null check (rating between 1 and 5),
  comment       text,
  created_at    timestamptz not null default now()
);

create index reviews_provider_idx on reviews (provider_id, created_at desc);

-- Mantém avg_rating e review_count sincronizados a cada avaliação.
create or replace function refresh_provider_rating()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target uuid := coalesce(new.provider_id, old.provider_id);
begin
  update provider_profiles p
  set avg_rating = coalesce(round(agg.avg_rating, 1), 0),
      review_count = coalesce(agg.total, 0)
  from (
    select avg(rating)::numeric as avg_rating, count(*) as total
    from reviews
    where provider_id = target
  ) agg
  where p.profile_id = target;

  return null;
end;
$$;

create trigger reviews_refresh_rating
  after insert or update or delete on reviews
  for each row execute function refresh_provider_rating();

-- ============================================================================
-- 5. Verificação manual (V0)
-- ============================================================================

create table verification_requests (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid not null references profiles(id) on delete cascade,
  -- Caminhos no bucket privado `verificacao`. Apagados na decisão:
  -- a política de retenção guarda apenas o status no perfil.
  document_path text,
  selfie_path   text,
  status        verification_status not null default 'em_analise',
  submitted_at  timestamptz not null default now(),
  reviewed_at   timestamptz,
  notes         text
);

create index verification_requests_status_idx
  on verification_requests (status, submitted_at);

-- Quem pode aprovar verificações. No V0, apenas o fundador.
create table admins (
  profile_id uuid primary key references profiles(id) on delete cascade
);

create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from admins where profile_id = auth.uid());
$$;

-- ============================================================================
-- 6. Views usadas pela aplicação
-- ============================================================================

create or replace view job_listings
with (security_invoker = true) as
select
  j.*,
  jsonb_build_object(
    'company_name', c.company_name,
    'logo_url',     c.logo_url,
    'doc_verified', p.doc_verified
  ) as company,
  (select count(*) from applications a where a.job_id = j.id) as applicant_count
from jobs j
join companies c on c.profile_id = j.company_id
join profiles  p on p.id = c.profile_id;

create or replace view provider_listings
with (security_invoker = true) as
select
  pp.*,
  p.full_name,
  p.phone,
  p.city,
  p.neighborhood,
  p.avatar_url,
  p.phone_verified,
  p.doc_verified,
  sc.slug as category_slug,
  jsonb_build_object('id', sc.id, 'slug', sc.slug, 'name', sc.name) as category
from provider_profiles pp
join profiles p on p.id = pp.profile_id
join service_categories sc on sc.id = pp.category_id
where p.role = 'prestador_servico';

create or replace view company_applications
with (security_invoker = true) as
select
  a.*,
  j.company_id,
  j.title as job_title,
  jsonb_build_object(
    'full_name',    p.full_name,
    'avatar_url',   p.avatar_url,
    'neighborhood', p.neighborhood,
    'desired_area', cp.desired_area,
    'resume_url',   cp.resume_url
  ) as candidate
from applications a
join jobs j on j.id = a.job_id
join profiles p on p.id = a.candidate_id
left join clt_profiles cp on cp.profile_id = a.candidate_id;

create or replace view verification_queue
with (security_invoker = true) as
select
  v.id,
  v.profile_id,
  p.full_name,
  p.role,
  sc.name as category,
  p.city,
  p.phone,
  v.submitted_at,
  v.status
from verification_requests v
join profiles p on p.id = v.profile_id
left join provider_profiles pp on pp.profile_id = p.id
left join service_categories sc on sc.id = pp.category_id;

-- ============================================================================
-- 7. Row Level Security
--
-- Regra geral: vagas e prestadores são públicos para leitura; cada pessoa só
-- escreve no próprio registro; candidatura é visível apenas para o candidato
-- dono e para a empresa dona da vaga.
-- ============================================================================

alter table profiles              enable row level security;
alter table clt_profiles          enable row level security;
alter table provider_profiles     enable row level security;
alter table companies             enable row level security;
alter table jobs                  enable row level security;
alter table applications          enable row level security;
alter table reviews               enable row level security;
alter table verification_requests enable row level security;
alter table service_categories    enable row level security;
alter table admins                enable row level security;

-- profiles ------------------------------------------------------------------
create policy "perfis sao publicos para leitura"
  on profiles for select using (true);

create policy "cada um edita o proprio perfil"
  on profiles for update using (auth.uid() = id) with check (auth.uid() = id);

create policy "admin edita qualquer perfil"
  on profiles for update using (is_admin());

-- clt_profiles --------------------------------------------------------------
-- Currículo não é público: só o dono e a empresa que recebeu a candidatura.
create policy "candidato le o proprio curriculo"
  on clt_profiles for select using (auth.uid() = profile_id);

create policy "empresa le curriculo de quem se candidatou"
  on clt_profiles for select using (
    exists (
      select 1
      from applications a
      join jobs j on j.id = a.job_id
      where a.candidate_id = clt_profiles.profile_id
        and j.company_id = auth.uid()
    )
  );

create policy "candidato escreve o proprio curriculo"
  on clt_profiles for all
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

-- provider_profiles ---------------------------------------------------------
create policy "prestadores sao publicos"
  on provider_profiles for select using (true);

create policy "prestador edita o proprio perfil"
  on provider_profiles for all
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

-- companies -----------------------------------------------------------------
create policy "empresas sao publicas"
  on companies for select using (true);

create policy "empresa edita o proprio cadastro"
  on companies for all
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

-- service_categories --------------------------------------------------------
create policy "categorias sao publicas"
  on service_categories for select using (true);

-- jobs ----------------------------------------------------------------------
create policy "vagas abertas sao publicas"
  on jobs for select using (status = 'aberta' or company_id = auth.uid());

create policy "empresa gerencia as proprias vagas"
  on jobs for all
  using (auth.uid() = company_id)
  with check (auth.uid() = company_id);

-- applications --------------------------------------------------------------
create policy "candidatura visivel ao candidato e a empresa da vaga"
  on applications for select using (
    auth.uid() = candidate_id
    or exists (
      select 1 from jobs j
      where j.id = applications.job_id and j.company_id = auth.uid()
    )
  );

create policy "candidato cria a propria candidatura"
  on applications for insert with check (auth.uid() = candidate_id);

create policy "candidato cancela a propria candidatura"
  on applications for delete using (auth.uid() = candidate_id);

create policy "empresa atualiza status da candidatura"
  on applications for update using (
    exists (
      select 1 from jobs j
      where j.id = applications.job_id and j.company_id = auth.uid()
    )
  );

-- reviews -------------------------------------------------------------------
-- No V0 quem avalia não precisa de conta: o formulário é público e vinculado
-- ao perfil do prestador. Moderação é reativa, pelo painel admin.
create policy "avaliacoes sao publicas"
  on reviews for select using (true);

create policy "qualquer pessoa pode avaliar"
  on reviews for insert with check (
    rating between 1 and 5
    and length(trim(reviewer_name)) > 0
  );

create policy "admin remove avaliacao denunciada"
  on reviews for delete using (is_admin());

-- verification_requests -----------------------------------------------------
create policy "pessoa ve o proprio pedido"
  on verification_requests for select using (auth.uid() = profile_id);

create policy "pessoa envia o proprio pedido"
  on verification_requests for insert with check (auth.uid() = profile_id);

create policy "admin ve todos os pedidos"
  on verification_requests for select using (is_admin());

create policy "admin decide pedidos"
  on verification_requests for update using (is_admin());

-- admins --------------------------------------------------------------------
create policy "admin ve a propria lista"
  on admins for select using (is_admin());

-- ============================================================================
-- 8. Storage
--
-- Rode no SQL Editor após criar os buckets pelo painel, ou use estes inserts.
-- `verificacao` é PRIVADO — documento e selfie são dados sensíveis (LGPD).
-- ============================================================================

insert into storage.buckets (id, name, public)
values
  ('avatares',    'avatares',    true),
  ('portfolio',   'portfolio',   true),
  ('curriculos',  'curriculos',  false),
  ('verificacao', 'verificacao', false)
on conflict (id) do nothing;

create policy "avatares publicos para leitura"
  on storage.objects for select
  using (bucket_id = 'avatares');

create policy "dono envia o proprio avatar"
  on storage.objects for insert
  with check (
    bucket_id = 'avatares' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "portfolio publico para leitura"
  on storage.objects for select
  using (bucket_id = 'portfolio');

create policy "prestador envia o proprio portfolio"
  on storage.objects for insert
  with check (
    bucket_id = 'portfolio' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "curriculo so do dono"
  on storage.objects for select
  using (
    bucket_id = 'curriculos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "candidato envia o proprio curriculo"
  on storage.objects for insert
  with check (
    bucket_id = 'curriculos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "verificacao so do dono ou admin"
  on storage.objects for select
  using (
    bucket_id = 'verificacao'
    and ((storage.foldername(name))[1] = auth.uid()::text or is_admin())
  );

create policy "pessoa envia o proprio documento"
  on storage.objects for insert
  with check (
    bucket_id = 'verificacao'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "admin apaga documento apos decisao"
  on storage.objects for delete
  using (bucket_id = 'verificacao' and is_admin());
