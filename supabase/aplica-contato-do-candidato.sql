-- =============================================================================
-- LUPA — contato e currículo do candidato na view da empresa
--
-- Rode UMA VEZ no banco de produção, no SQL Editor do Supabase. Banco novo
-- não precisa: o `schema.sql` já traz tudo isto.
--
-- POR QUE
-- ───────
-- `company_applications` trazia nome, avatar, bairro, área desejada e o
-- caminho do currículo. Não trazia telefone nem e-mail — então a empresa
-- recebia o currículo e não tinha como chamar a pessoa.
--
-- Currículo que chega e não vira conversa é a mesma coisa que currículo que
-- não chegou. Sem contato, "receber currículo organizado" para na
-- organização.
--
-- O QUE AUTORIZA ISTO
-- ───────────────────
-- O ato de se candidatar. É ele que dá o consentimento e é ele que delimita
-- o alcance: a empresa vê este candidato porque ele se candidatou à vaga
-- dela, e a consulta filtra sempre por `company_id` da sessão.
--
-- Duas coisas seguram esse limite, e nenhuma delas pode ser afrouxada:
--
--   1. A view continua revogada para `anon` e `authenticated`. Sem isso,
--      qualquer um com a chave do navegador teria a lista de telefone de
--      quem está procurando emprego na cidade.
--   2. Quem lê é o servidor, com a chave de serviço, filtrando pela empresa
--      da sessão. Não existe tela que receba `company_id` de fora.
--
-- Aditivo e repetível: `create or replace` não perde dado nem permissão.
-- =============================================================================

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
    'email',        u.email,
    'phone',        u.telefone,
    'desired_area', pc.area_desejada,
    'availability', pc.disponibilidade,
    'summary',      pc.resumo,
    'experiences',  coalesce(pc.experiencias, '[]'::jsonb),
    'education',    pc.formacao,
    'skills',       coalesce(pc.habilidades, '{}'::text[]),
    'resume_url',   pc.curriculo_url
  ) as candidate
from candidaturas c
join vagas v on v.id = c.vaga_id
join usuarios u on u.id = c.candidato_id
left join perfis_candidato pc on pc.usuario_id = c.candidato_id;

/*
 * Repetido de propósito depois do `create or replace`.
 *
 * Recriar a view em alguns casos devolve a ela o `select` padrão que o
 * Supabase concede a `anon` no schema `public`. Confiar em que não devolveu
 * é confiar em detalhe de plataforma — e o que está em jogo aqui é
 * telefone de gente procurando emprego.
 */
revoke select on company_applications from anon, authenticated;

-- ─── Conferência ────────────────────────────────────────────────────────
-- `tem_contato` deve ser true; `anon_le` deve ser false.

select
  (
    select count(*) = 2
      from jsonb_object_keys(
        (select candidate from company_applications limit 1)
      ) as chave
     where chave in ('email', 'phone')
  ) as tem_contato,
  has_table_privilege('anon', 'company_applications', 'SELECT') as anon_le;
