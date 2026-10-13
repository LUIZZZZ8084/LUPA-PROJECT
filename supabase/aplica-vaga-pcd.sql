-- ============================================================================
-- Vaga para pessoa com deficiência (#456)
--
-- A empresa informa na hora de publicar, e a busca ganha o filtro. A coluna
-- é `not null default false`: vaga publicada antes dela não era para PCD, e
-- o default avaliado uma vez dá a todas o valor certo.
--
-- A Lupa não guarda se o candidato é PCD — é dado de saúde, e o filtro
-- funciona sem isso.
--
-- **Rode antes do deploy**: o código novo manda `para_pcd` no insert, e sem
-- a coluna publicar vaga falha. Seguro de rodar mais de uma vez.
-- ============================================================================

begin;

alter table vagas add column if not exists para_pcd boolean not null default false;

create or replace view job_listings
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
    'pessoa_fisica', (e.cnpj is null),
    'site',         e.site,
    'instagram',    e.instagram,
    'facebook',     e.facebook
  ) as company,
  (select count(*) from candidaturas c where c.vaga_id = v.id) as applicant_count,
  v.expira_em                 as expires_at,
  v.modalidade                as work_mode,
  v.para_pcd                  as for_pcd
from vagas v
join perfis_empresa e on e.usuario_id = v.empresa_id
join usuarios u on u.id = e.usuario_id;

-- `create or replace` mantém os grants, e isto os reafirma sem abrir nada
-- além da leitura que a view já tinha.
grant select on job_listings to anon, authenticated;

commit;

select
  exists (select 1 from information_schema.columns
    where table_name = 'vagas' and column_name = 'para_pcd') as coluna_existe,
  exists (select 1 from information_schema.columns
    where table_name = 'job_listings' and column_name = 'for_pcd') as view_expoe;
