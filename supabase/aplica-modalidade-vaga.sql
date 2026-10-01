-- ============================================================================
-- Modalidade da vaga: presencial, home office ou híbrido (#300)
--
-- Coluna opcional: vaga publicada antes desta migração continua válida e só
-- não mostra o selo. A tela de publicação passa a exigir a escolha.
--
-- Aditivo e repetível: rodar duas vezes não quebra nem duplica nada.
-- ============================================================================

begin;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'modalidade_vaga') then
    create type modalidade_vaga as enum ('presencial', 'home_office', 'hibrido');
  end if;
end
$$;

alter table vagas add column if not exists modalidade modalidade_vaga;

-- Coluna nova ao final do select, porque `create or replace view` não
-- aceita mudar a ordem das existentes.
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
  v.modalidade                as work_mode
from vagas v
join perfis_empresa e on e.usuario_id = v.empresa_id
join usuarios u on u.id = e.usuario_id;

grant select on job_listings to anon, authenticated;

commit;

-- ─── Conferência ────────────────────────────────────────────────────────
select
  exists (select 1 from information_schema.columns
    where table_name = 'vagas' and column_name = 'modalidade') as coluna_existe,
  exists (select 1 from information_schema.columns
    where table_name = 'job_listings' and column_name = 'work_mode') as view_expoe;
