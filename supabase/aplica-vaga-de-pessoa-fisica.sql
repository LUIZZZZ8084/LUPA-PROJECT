-- =============================================================================
-- LUPA — a vaga diz se quem contrata é pessoa ou empresa (#129)
--
-- Rode UMA VEZ no banco de produção, no SQL Editor do Supabase. Banco novo
-- não precisa: o `schema.sql` já traz isto.
--
-- O que muda: `job_listings.company` ganha `pessoa_fisica`, derivado de
-- `perfis_empresa.cnpj is null`. Quem procura emprego tem direito de saber
-- se está tratando com uma empresa registrada ou com uma pessoa.
--
-- Vai o booleano, nunca o documento: esta view é lida pela chave anônima.
-- CNPJ pode ser público porque é registro público; o CPF de quem contrata
-- como pessoa física mora em `usuarios` e não sai de lá.
--
-- Sem isto aplicado, a tela cai no caso "não sei" e não desenha selo nenhum
-- — degradação, não queda.
--
-- É `create or replace`: repetível, e não toca em dado nenhum.
-- =============================================================================

begin;

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
  (select count(*) from candidaturas c where c.vaga_id = v.id) as applicant_count
from vagas v
join perfis_empresa e on e.usuario_id = v.empresa_id
join usuarios u on u.id = e.usuario_id;

commit;

-- Confirme: deve devolver `true`.
select exists (
  select 1
  from information_schema.view_column_usage
  where view_name = 'job_listings'
) as view_existe,
  (select (company ? 'pessoa_fisica') from job_listings limit 1)
    as company_tem_pessoa_fisica;
