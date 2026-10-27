-- ============================================================================
-- Perguntas de triagem na vaga (#491)
--
-- A empresa escreve até três perguntas de sim ou não ao publicar, e marca
-- cada uma como eliminatória (a resposta esperada é Sim) ou só informativa.
-- Quem se candidata responde antes de enviar, e a lista da empresa separa
-- quem respondeu o que a vaga exigia de quem não — sem esconder ninguém.
--
-- O que muda no banco:
--   * `vagas.perguntas` (jsonb, lista de até três): dentro da própria linha
--     da vaga, para publicar ser uma instrução só;
--   * `candidaturas.respostas` (jsonb, lista de verdadeiro e falso na ordem
--     das perguntas), nulo em toda candidatura anterior;
--   * `candidaturas_confere_triagem`: vaga com perguntas não recebe
--     candidatura sem as respostas completas;
--   * `job_listings` ganha `screening_questions` e `company_applications`
--     ganha `answers` e `job_questions`, ambas no fim (regra do
--     `create or replace view`).
--
-- Vaga e candidatura que já existem ficam como estão: perguntas `[]` e
-- respostas nulas.
--
-- **Rode antes do deploy**: o código novo manda `perguntas` no insert da
-- vaga e `respostas` no da candidatura, e sem as colunas publicar e
-- candidatar-se falham. Seguro de rodar mais de uma vez.
-- ============================================================================

begin;

alter table vagas
  add column if not exists perguntas jsonb not null default '[]'::jsonb
    check (jsonb_typeof(perguntas) = 'array'
           and jsonb_array_length(perguntas) <= 3);

alter table candidaturas
  add column if not exists respostas jsonb
    check (respostas is null or jsonb_typeof(respostas) = 'array');

/*
 * Vaga com perguntas não recebe candidatura sem respostas (#491).
 *
 * A aplicação confere antes, para dar a mensagem; o banco confere de novo
 * porque "sem responder todas, não envia" é regra de produto, e a action
 * pode ser chamada direto. A resposta tem de ser uma lista de verdadeiro e
 * falso do mesmo tamanho da lista de perguntas. Vaga **sem** pergunta
 * descarta o que vier: lixo na entrada não vira dado.
 *
 * Só no `insert`: as respostas nunca mudam, e mover a candidatura de
 * estágio não pode esbarrar numa regra de quando ela nasceu.
 */
create or replace function candidatura_confere_triagem()
returns trigger language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_perguntas jsonb;
begin
  select perguntas into v_perguntas from vagas where id = new.vaga_id;

  if coalesce(jsonb_array_length(v_perguntas), 0) = 0 then
    new.respostas := null;
    return new;
  end if;

  if new.respostas is null
     or jsonb_typeof(new.respostas) <> 'array'
     or jsonb_array_length(new.respostas) <> jsonb_array_length(v_perguntas)
     or exists (
       select 1 from jsonb_array_elements(new.respostas) r
       where jsonb_typeof(r) <> 'boolean'
     ) then
    raise exception 'respostas de triagem incompletas'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists candidaturas_confere_triagem on candidaturas;
create trigger candidaturas_confere_triagem
  before insert on candidaturas
  for each row execute function candidatura_confere_triagem();

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
  v.perguntas                 as screening_questions
from vagas v
join perfis_empresa e on e.usuario_id = v.empresa_id
join usuarios u on u.id = e.usuario_id;

-- `create or replace` mantém os grants, e isto os reafirma sem abrir nada
-- além da leitura que a view já tinha.
grant select on job_listings to anon, authenticated;

create or replace view company_applications
with (security_invoker = false) as
select
  c.id,
  c.vaga_id       as job_id,
  c.candidato_id  as candidate_id,
  c.status,
  c.criado_em     as created_at,
  v.empresa_id    as company_id,
  v.titulo        as job_title,
  jsonb_build_object(
    'full_name',    u.nome_completo,
    'avatar_url',   u.avatar_url,
    'neighborhood', u.bairro,
    'city',         u.cidade,
    /*
     * Contato do candidato, para a empresa dona da vaga.
     *
     * Está aqui porque candidatura sem contato não vira entrevista — a
     * empresa recebe o currículo, não tem como chamar, e o produto para
     * na organização. Quem se candidatou consentiu com isto: é o ato de
     * se candidatar que autoriza o contato, e é ele que delimita quem
     * alcança o quê.
     *
     * A view continua revogada para a chave anônima, e o `where` de quem
     * a consulta é sempre a empresa da sessão. Sem as duas coisas, isto
     * viraria lista de telefone de quem está procurando emprego.
     */
    'email',        u.email,
    'phone',        u.telefone,
    'desired_area', pc.area_desejada,
    'availability', pc.disponibilidade,
    'summary',      pc.resumo,
    'experiences',  coalesce(pc.experiencias, '[]'::jsonb),
    'education',    pc.formacao,
    'skills',       coalesce(pc.habilidades, '{}'::text[]),
    'resume_url',   pc.curriculo_url
  ) as candidate,
  -- Coluna nova só no fim (#491): as respostas à triagem e as perguntas a
  -- que elas se referem, para a empresa ler uma ao lado da outra.
  c.respostas     as answers,
  v.perguntas     as job_questions
from candidaturas c
join vagas v on v.id = c.vaga_id
join usuarios u on u.id = c.candidato_id
left join perfis_candidato pc on pc.usuario_id = c.candidato_id;

commit;

-- Funções só pela chave de serviço (#449): o `revoke ... on all functions`
-- só alcança as que já existem, então roda de novo depois de criar função.
revoke execute on all functions in schema public
  from public, anon, authenticated;
grant execute on all functions in schema public to service_role;

alter default privileges in schema public
  revoke execute on functions from anon, authenticated;
