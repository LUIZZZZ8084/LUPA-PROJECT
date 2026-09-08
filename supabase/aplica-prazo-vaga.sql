-- ============================================================================
-- Prazo de 30 dias para vaga, reativação manual
--
-- Toda vaga publicada expira 30 dias depois. Expirada não aparece mais em
-- /vagas nem na home, mas a empresa reativa de graça a qualquer momento —
-- reativar só estende `expira_em`, nunca mexe em `status`. "Expirada" é
-- sempre calculado a partir de `expira_em` (ver `vagaExpirada` em
-- src/lib/format.ts), nunca guardado como um terceiro valor de `status` —
-- isso evita depender de um job agendado para o estado ficar certo: a
-- correção mora inteira na consulta, não numa rotina que pode atrasar.
--
-- Vaga já publicada antes desta migração ganha 30 dias a partir de agora
-- (avaliado uma vez, no momento da migração) — ninguém perde o anúncio no
-- dia do deploy.
-- ============================================================================

begin;

alter table vagas
  add column if not exists expira_em timestamptz
    not null default (now() + interval '30 days');

commit;

-- ─── Conferência ────────────────────────────────────────────────────────
select
  exists (select 1 from information_schema.columns
    where table_name = 'vagas' and column_name = 'expira_em') as coluna_existe,
  (select count(*) from vagas where expira_em is null) as linhas_sem_prazo;

-- Expõe o prazo na busca pública, para o filtro em src/lib/data.ts
-- (`getJobs`) poder excluir vaga expirada sem depender de `status` ter
-- sido atualizado por ninguém. Coluna nova ao final do select, porque
-- `create or replace view` não aceita mudar a ordem das existentes.
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
  v.expira_em                 as expires_at
from vagas v
join perfis_empresa e on e.usuario_id = v.empresa_id
join usuarios u on u.id = e.usuario_id;

grant select on job_listings to anon, authenticated;
