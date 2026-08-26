-- =============================================================================
-- LUPA — habilidades da vaga, para a recomendação de candidatos
--
-- Rode UMA VEZ no banco de produção, no SQL Editor do Supabase. Banco novo
-- não precisa: o `schema.sql` já traz tudo isto.
--
-- POR QUE
-- ───────
-- O painel ganhou "Recomendados para você": entre quem já se candidatou, o
-- sistema põe na frente quem tem as habilidades que a vaga pede. Para isso
-- a vaga precisa poder dizer o que pede — hoje ela só tem título,
-- descrição e categoria.
--
-- O campo é **opcional**, com `default '{}'`. Toda vaga publicada antes
-- dele existir chega vazia, e nesse caso o casamento lê o título e a
-- descrição. Sem essa reserva, o bloco nasceria vazio para todo mundo — e
-- ninguém preenche um campo cujo resultado nunca viu.
--
-- O que o banco guarda é o texto como a empresa escreveu. A normalização
-- ("CNH D" e "carteira D" são a mesma exigência) é da aplicação, em
-- `src/lib/skills.ts`, onde qualquer um lê a tabela de sinônimos e corrige.
-- Normalizar na gravação apagaria a palavra da pessoa, que é justamente o
-- que a tela mostra de volta.
--
-- Aditivo e repetível.
-- =============================================================================

alter table vagas
  add column if not exists habilidades text[] not null default '{}';

/*
 * A view precisa ser recriada para expor a coluna nova.
 *
 * `create or replace view` recusa mudança na lista de colunas de uma view
 * existente, então é `drop` e `create` — e por isso o `revoke` vem logo
 * depois: view recriada volta a receber o `select` que o Supabase concede
 * a `anon` por padrão no schema `public`.
 *
 * `job_listings` é pública de propósito (é o catálogo de vagas), então o
 * grant é reafirmado em vez de revogado. Está aqui explícito para quem ler
 * este arquivo não precisar adivinhar qual dos dois casos é.
 */
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
  v.tipo_contrato             as contract_type,
  v.salario_min               as salary_min,
  v.salario_max               as salary_max,
  v.habilidades               as skills,
  v.status,
  v.criado_em                 as created_at,
  jsonb_build_object(
    'company_name', e.razao_social,
    'logo_url',     e.logo_url,
    'doc_verified', u.doc_verificado
  ) as company,
  (select count(*) from candidaturas c where c.vaga_id = v.id) as applicant_count
from vagas v
join perfis_empresa e on e.usuario_id = v.empresa_id
join usuarios u on u.id = e.usuario_id;

grant select on job_listings to anon, authenticated;

-- ─── Conferência ────────────────────────────────────────────────────────
-- `coluna_existe` e `anon_le_o_catalogo` devem ser true.

select
  exists (
    select 1 from information_schema.columns
     where table_name = 'vagas' and column_name = 'habilidades'
  ) as coluna_existe,
  exists (
    select 1 from information_schema.columns
     where table_name = 'job_listings' and column_name = 'skills'
  ) as view_expoe,
  has_table_privilege('anon', 'job_listings', 'SELECT') as anon_le_o_catalogo;
