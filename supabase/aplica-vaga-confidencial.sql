-- ============================================================================
-- Vaga confidencial, em nome de um cliente (#538)
--
-- A agência de emprego publica com a própria conta e descreve o cliente sem
-- dizer quem é. O nome do cliente nunca é gravado: só a descrição, nesta
-- coluna. Nula é a vaga comum.
--
-- **Rode antes do deploy**: o código novo manda `contratante_confidencial`
-- no insert, e sem a coluna publicar vaga falha. Seguro de rodar mais de uma
-- vez. A view é a mesma do `schema.sql`, com a coluna nova no fim — a regra
-- do `create or replace view`.
-- ============================================================================

begin;

alter table vagas add column if not exists contratante_confidencial text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'vagas_contratante_confidencial_check'
  ) then
    alter table vagas add constraint vagas_contratante_confidencial_check
      check (contratante_confidencial is null
             or char_length(contratante_confidencial) between 3 and 80);
  end if;
end $$;

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
    /*
     * Quem contrata é pessoa ou empresa (#129).
     *
     * Vai o booleano derivado do CNPJ, nunca o documento: esta view é
     * lida pela chave anônima. CNPJ pode ser público porque é registro
     * público; o CPF de quem contrata como pessoa física mora em
     * `usuarios` e não sai de lá.
     *
     * Quem procura emprego tem direito de saber se está tratando com uma
     * empresa registrada ou com uma pessoa — muda o que ela pode
     * conferir antes de ir a uma entrevista.
     */
    'pessoa_fisica', (e.cnpj is null),
    'site',         e.site,
    'instagram',    e.instagram,
    'facebook',     e.facebook
  ) as company,
  (select count(*) from candidaturas c where c.vaga_id = v.id) as applicant_count,
  v.expira_em                 as expires_at,
  -- Por último: `create or replace view` só aceita coluna nova no fim, e é
  -- assim que `aplica-modalidade-vaga.sql` chega a um banco vivo (#300).
  v.modalidade                as work_mode,
  -- E depois dela, pela mesma regra (#456): coluna nova só no fim.
  v.para_pcd                  as for_pcd,
  -- E as perguntas de triagem (#491), pela mesma regra.
  v.perguntas                 as screening_questions,
  -- E o cliente em sigilo da agência (#538), pela mesma regra.
  v.contratante_confidencial  as hiring_for
from vagas v
join perfis_empresa e on e.usuario_id = v.empresa_id
join usuarios u on u.id = e.usuario_id;

-- `create or replace` mantém os grants, e isto os reafirma sem abrir nada
-- além da leitura que a view já tinha.
grant select on job_listings to anon, authenticated;

commit;

select
  exists (select 1 from information_schema.columns
    where table_name = 'vagas' and column_name = 'contratante_confidencial') as coluna_existe,
  exists (select 1 from information_schema.columns
    where table_name = 'job_listings' and column_name = 'hiring_for') as view_expoe;
