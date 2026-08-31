-- =============================================================================
-- LUPA — Instagram e Facebook no perfil de empresa e de prestador
--
-- Rode UMA VEZ no banco de produção, no SQL Editor do Supabase. Banco novo
-- não precisa: o `schema.sql` já traz tudo isto.
--
-- POR QUE
-- ───────
-- Prestador autônomo no Brasil costuma divulgar mais pelo Instagram do que
-- por site próprio, e hoje não tinha nenhum campo de presença online.
-- Empresa já tinha `site`, mas essa coluna nunca chegou a aparecer em
-- lugar nenhum — nem na tela pública, nem no próprio "como você aparece" —
-- então de quebra o `site` também passa a ser exibido aqui.
--
-- Os três campos são opcionais e informativos: não entram em nenhum
-- ranking, só dão o link para quem já decidiu ler.
--
-- Aditivo e repetível.
-- =============================================================================

/*
 * Tudo numa transação só, como nas migrações anteriores de coluna: o passo
 * do meio derruba `job_listings` e `provider_listings`, os dois catálogos
 * públicos do app. Se o `create` seguinte falhar, sem transação as views
 * ficam destruídas e a busca sai do ar até alguém perceber.
 */
begin;

alter table perfis_prestador
  add column if not exists instagram text,
  add column if not exists facebook text;

alter table perfis_empresa
  add column if not exists instagram text,
  add column if not exists facebook text;

drop view if exists provider_listings;

create view provider_listings
with (security_invoker = false) as
select
  pp.usuario_id                          as profile_id,
  pp.categoria_id                        as category_id,
  pp.descricao                           as description,
  pp.preco_inicial                       as starting_price,
  pp.anos_experiencia                    as years_experience,
  pp.bairros_atendidos                   as service_area,
  pp.fotos_urls                          as photo_urls,
  pp.nota_media                          as avg_rating,
  pp.total_avaliacoes                    as review_count,
  pp.instagram                           as instagram,
  pp.facebook                            as facebook,
  u.nome_completo                        as full_name,
  u.telefone                             as phone,
  u.cidade                               as city,
  u.bairro                               as neighborhood,
  u.avatar_url                           as avatar_url,
  u.telefone_verificado                  as phone_verified,
  u.doc_verificado                       as doc_verified,
  c.slug                                 as category_slug,
  jsonb_build_object('id', c.id, 'slug', c.slug, 'name', c.nome) as category
from perfis_prestador pp
join usuarios u on u.id = pp.usuario_id
join categorias_servico c on c.id = pp.categoria_id
where u.papel = 'prestador_servico';

drop view if exists job_listings;

create view job_listings
with (security_invoker = false) as
select
  v.id,
  v.empresa_id                as company_id,
  v.titulo                    as title,
  v.descricao                 as description,
  v.categoria                 as category,
  v.cidade                    as city,
  v.bairro                    as neighborhood,
  v.endereco                  as address,
  v.tipo_contrato             as contract_type,
  v.salario_min               as salary_min,
  v.salario_max               as salary_max,
  v.habilidades               as skills,
  v.status,
  v.criado_em                 as created_at,
  jsonb_build_object(
    'company_name', e.razao_social,
    'logo_url',     e.logo_url,
    'doc_verified', u.doc_verificado,
    'site',         e.site,
    'instagram',    e.instagram,
    'facebook',     e.facebook
  ) as company,
  (select count(*) from candidaturas c where c.vaga_id = v.id) as applicant_count
from vagas v
join perfis_empresa e on e.usuario_id = v.empresa_id
join usuarios u on u.id = e.usuario_id;

grant select on provider_listings, job_listings to anon, authenticated;

commit;

-- ─── Conferência ────────────────────────────────────────────────────────
-- As quatro colunas e as duas views devem existir; `anon_le` deve ser true
-- para as duas.

select
  exists (
    select 1 from information_schema.columns
     where table_name = 'perfis_prestador' and column_name = 'instagram'
  ) as prestador_tem_instagram,
  exists (
    select 1 from information_schema.columns
     where table_name = 'perfis_empresa' and column_name = 'instagram'
  ) as empresa_tem_instagram,
  exists (
    select 1 from information_schema.columns
     where table_name = 'provider_listings' and column_name = 'instagram'
  ) as provider_listings_expoe,
  exists (
    select 1 from information_schema.columns
     where table_name = 'job_listings' and column_name = 'company'
  ) as job_listings_expoe,
  has_table_privilege('anon', 'provider_listings', 'SELECT') as anon_le_prestadores,
  has_table_privilege('anon', 'job_listings', 'SELECT') as anon_le_vagas;
