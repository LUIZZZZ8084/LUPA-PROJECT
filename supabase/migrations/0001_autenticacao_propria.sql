-- ============================================================================
-- 0001 — Autenticação própria
--
-- Substitui a dependência de `auth.users` (Supabase Auth) por uma tabela
-- `usuarios` sob nosso controle.
--
-- Por quê:
--
-- 1. O hash de senha passa a ser nosso, testável e auditável. Com Supabase
--    Auth, o algoritmo e os parâmetros são caixa-preta e não dá para provar
--    em teste que a senha nunca é gravada em claro.
-- 2. O app deixa de depender de um fornecedor específico: roda em qualquer
--    Postgres. Trocar de hospedagem não exige migrar contas de usuário.
-- 3. Permite testar cadastro e login inteiros sem infraestrutura, o que é o
--    que mantém o modo demonstração funcionando.
--
-- O que se perde, e precisa ser construído: verificação de e-mail,
-- recuperação de senha e login social. Os dois primeiros entram antes de
-- abrir o cadastro ao público.
--
-- Nada está em produção ainda, então esta migração recria as tabelas de
-- identidade em vez de tentar preservar dados.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- Limpeza do modelo anterior
-- ----------------------------------------------------------------------------

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists handle_new_user();

drop view if exists verification_queue;
drop view if exists company_applications;
drop view if exists provider_listings;
drop view if exists job_listings;

-- ----------------------------------------------------------------------------
-- Identidade
-- ----------------------------------------------------------------------------

create type papel_usuario as enum (
  'candidato_clt',
  'prestador_servico',
  'empresa',
  'admin'
);

create table usuarios (
  id                   uuid primary key default gen_random_uuid(),
  email                text not null,
  -- Argon2id. Nunca sai desta tabela para a aplicação.
  senha_hash           text not null,
  papel                papel_usuario not null,
  nome_completo        text not null,
  telefone             text not null,
  cidade               text not null default 'Sinop',
  bairro               text,
  avatar_url           text,
  email_verificado     boolean not null default false,
  telefone_verificado  boolean not null default false,
  doc_verificado       boolean not null default false,
  status_verificacao   verification_status not null default 'pendente',
  criado_em            timestamptz not null default now(),
  atualizado_em        timestamptz not null default now(),
  ultimo_acesso_em     timestamptz
);

-- E-mail único sem depender de maiúsculas: "Joao@" e "joao@" são a mesma
-- pessoa, e permitir os dois cria duas contas para quem só errou o teclado.
create unique index usuarios_email_unico on usuarios (lower(email));

create index usuarios_papel_cidade_idx on usuarios (papel, cidade);
create index usuarios_criado_em_idx on usuarios (criado_em desc);

create or replace function tocar_atualizado_em()
returns trigger language plpgsql as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

create trigger usuarios_atualizado_em
  before update on usuarios
  for each row execute function tocar_atualizado_em();

-- ----------------------------------------------------------------------------
-- Perfis por papel
-- ----------------------------------------------------------------------------

create table perfis_candidato (
  usuario_id      uuid primary key references usuarios(id) on delete cascade,
  area_desejada   text,
  resumo          text,
  experiencias    jsonb not null default '[]',
  formacao        text,
  habilidades     text[] not null default '{}',
  curriculo_url   text,
  disponibilidade text
);

create table perfis_prestador (
  usuario_id        uuid primary key references usuarios(id) on delete cascade,
  categoria_id      int references service_categories(id),
  descricao         text,
  preco_inicial     numeric(10,2),
  anos_experiencia  int,
  bairros_atendidos text[] not null default '{}',
  fotos_urls        text[] not null default '{}',
  nota_media        numeric(2,1) not null default 0,
  total_avaliacoes  int not null default 0
);

create index perfis_prestador_categoria_idx on perfis_prestador (categoria_id);
create index perfis_prestador_nota_idx on perfis_prestador (nota_media desc);

create table perfis_empresa (
  usuario_id   uuid primary key references usuarios(id) on delete cascade,
  razao_social text not null,
  cnpj         text not null unique,
  setor        text,
  porte        text,
  site         text,
  descricao    text,
  logo_url     text,
  plano        company_plan not null default 'trial'
);

-- ----------------------------------------------------------------------------
-- Repontar as tabelas existentes para `usuarios`
-- ----------------------------------------------------------------------------

alter table jobs
  drop constraint if exists jobs_company_id_fkey,
  add constraint jobs_empresa_fkey
    foreign key (company_id) references perfis_empresa(usuario_id) on delete cascade;

alter table applications
  drop constraint if exists applications_candidate_id_fkey,
  add constraint applications_candidato_fkey
    foreign key (candidate_id) references usuarios(id) on delete cascade;

alter table reviews
  drop constraint if exists reviews_provider_id_fkey,
  add constraint reviews_prestador_fkey
    foreign key (provider_id) references usuarios(id) on delete cascade;

alter table verification_requests
  drop constraint if exists verification_requests_profile_id_fkey,
  add constraint verification_requests_usuario_fkey
    foreign key (profile_id) references usuarios(id) on delete cascade;

alter table admins
  drop constraint if exists admins_profile_id_fkey,
  add constraint admins_usuario_fkey
    foreign key (profile_id) references usuarios(id) on delete cascade;

-- As tabelas antigas de perfil saem depois de repontar as dependências.
drop table if exists clt_profiles;
drop table if exists provider_profiles;
drop table if exists companies;
drop table if exists profiles;

-- ----------------------------------------------------------------------------
-- Segurança
-- ----------------------------------------------------------------------------

alter table usuarios         enable row level security;
alter table perfis_candidato enable row level security;
alter table perfis_prestador enable row level security;
alter table perfis_empresa   enable row level security;

/*
 * `usuarios` guarda o hash de senha e fica inteiramente fora do alcance de
 * qualquer sessão de cliente. Sem policy de select, o RLS nega tudo por
 * padrão — a aplicação acessa esta tabela apenas pela chave de serviço, do
 * lado do servidor.
 *
 * Os dados públicos de perfil ficam nas views abaixo, que expõem só o que
 * pode ser visto.
 */

create policy "perfis de prestador sao publicos"
  on perfis_prestador for select using (true);

create policy "perfis de empresa sao publicos"
  on perfis_empresa for select using (true);

-- Currículo não é público: nem todo mundo quer que o patrão atual descubra
-- que está procurando emprego.
create policy "candidato le o proprio perfil"
  on perfis_candidato for select
  using (usuario_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'sub')::uuid);

-- ----------------------------------------------------------------------------
-- Views públicas, recriadas sobre o novo modelo
-- ----------------------------------------------------------------------------

create or replace view provider_listings
with (security_invoker = true) as
select
  pp.usuario_id as profile_id,
  pp.categoria_id as category_id,
  pp.descricao as description,
  pp.preco_inicial as starting_price,
  pp.anos_experiencia as years_experience,
  pp.bairros_atendidos as service_area,
  pp.fotos_urls as photo_urls,
  pp.nota_media as avg_rating,
  pp.total_avaliacoes as review_count,
  u.nome_completo as full_name,
  u.telefone as phone,
  u.cidade as city,
  u.bairro as neighborhood,
  u.avatar_url,
  u.telefone_verificado as phone_verified,
  u.doc_verificado as doc_verified,
  sc.slug as category_slug,
  jsonb_build_object('id', sc.id, 'slug', sc.slug, 'name', sc.name) as category
from perfis_prestador pp
join usuarios u on u.id = pp.usuario_id
join service_categories sc on sc.id = pp.categoria_id
where u.papel = 'prestador_servico';

create or replace view job_listings
with (security_invoker = true) as
select
  j.*,
  jsonb_build_object(
    'company_name', e.razao_social,
    'logo_url',     e.logo_url,
    'doc_verified', u.doc_verificado
  ) as company,
  (select count(*) from applications a where a.job_id = j.id) as applicant_count
from jobs j
join perfis_empresa e on e.usuario_id = j.company_id
join usuarios u on u.id = e.usuario_id;

create or replace view company_applications
with (security_invoker = true) as
select
  a.*,
  j.company_id,
  j.title as job_title,
  jsonb_build_object(
    'full_name',    u.nome_completo,
    'avatar_url',   u.avatar_url,
    'neighborhood', u.bairro,
    'desired_area', pc.area_desejada,
    'resume_url',   pc.curriculo_url
  ) as candidate
from applications a
join jobs j on j.id = a.job_id
join usuarios u on u.id = a.candidate_id
left join perfis_candidato pc on pc.usuario_id = a.candidate_id;

create or replace view verification_queue
with (security_invoker = true) as
select
  v.id,
  v.profile_id,
  u.nome_completo as full_name,
  u.papel as role,
  sc.name as category,
  u.cidade as city,
  u.telefone as phone,
  v.submitted_at,
  v.status
from verification_requests v
join usuarios u on u.id = v.profile_id
left join perfis_prestador pp on pp.usuario_id = u.id
left join service_categories sc on sc.id = pp.categoria_id;

commit;
