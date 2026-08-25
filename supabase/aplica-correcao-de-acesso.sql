-- =============================================================================
-- LUPA — view que faltava e revogação das tabelas sensíveis
--
-- Rode UMA VEZ no banco de produção, no SQL Editor do Supabase. Banco novo
-- não precisa: o `schema.sql` já traz tudo isto.
--
-- Corrige duas coisas encontradas na auditoria da Issue #64, conferidas
-- contra o banco de produção e não só lendo o código.
--
-- 1. `candidate_applications` não existe lá.
--
--    Está no `schema.sql` desde que "Minhas candidaturas" foi escrita, mas
--    o banco de produção foi criado de uma versão anterior do arquivo — e
--    `schema.sql` só roda inteiro em banco limpo. O efeito é erro 500 para
--    todo candidato que abre `/perfil/candidaturas`, que é justamente a
--    tela que mostra à pessoa que a candidatura dela chegou a algum lugar.
--
-- 2. `usuarios`, `admins`, `perfis_candidato` e `candidaturas` têm `select`
--    concedido para `anon`.
--
--    Hoje não vaza: a RLS barra tudo, e a chave anônima lê zero linha onde
--    o banco tem dezessete. Mas é uma camada só. O Supabase concede select
--    a `anon` em toda tabela nova do schema `public` por padrão, então
--    basta alguém criar uma policy por engano — ou desligar a RLS para
--    depurar e esquecer — para a tabela inteira abrir. `usuarios` guarda
--    hash de senha; `perfis_candidato` guarda currículo, que é o registro
--    de quem está procurando emprego.
--
-- Tudo aqui é aditivo e repetível: rodar duas vezes não muda o resultado
-- nem toca em dado existente.
-- =============================================================================

-- ─── 1. A view que faltava ──────────────────────────────────────────────

create or replace view candidate_applications
with (security_invoker = false) as
select
  c.id,
  c.vaga_id      as job_id,
  c.candidato_id as candidate_id,
  c.status,
  c.criado_em    as created_at,
  v.titulo       as job_title,
  e.razao_social as company_name
from candidaturas c
join vagas v on v.id = c.vaga_id
join perfis_empresa e on e.usuario_id = v.empresa_id;

/*
 * `security_invoker = false` de propósito, como as outras: a view roda com
 * a permissão de quem a criou e alcança `candidaturas`, que é fechada. O
 * que ela expõe é uma projeção segura — nenhuma coluna de currículo, nenhum
 * telefone. Quem a lê é o servidor, com a chave de serviço.
 */
revoke select on candidate_applications from anon, authenticated;

-- ─── 2. As tabelas que a RLS já barra, agora barradas duas vezes ────────

revoke select on usuarios         from anon, authenticated;
revoke select on admins           from anon, authenticated;
revoke select on perfis_candidato from anon, authenticated;
revoke select on candidaturas     from anon, authenticated;

-- ─── Conferência ────────────────────────────────────────────────────────
-- `existe` deve ser true na primeira linha; `anon_le` deve ser false em
-- todas as demais.

select 'candidate_applications' as objeto,
       to_jsonb(count(*) > 0) as resultado,
       'existe' as pergunta
  from information_schema.views
 where table_schema = 'public' and table_name = 'candidate_applications'

union all

select t.nome,
       to_jsonb(has_table_privilege('anon', t.nome, 'SELECT')),
       'anon_le'
  from (values ('usuarios'), ('admins'), ('perfis_candidato'),
               ('candidaturas'), ('candidate_applications')) as t(nome);
