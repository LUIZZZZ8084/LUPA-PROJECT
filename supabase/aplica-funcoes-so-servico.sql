-- ============================================================================
-- Funções do banco só pela chave de serviço (#449)
--
-- O Supabase publica toda função do schema público pela API, e por padrão a
-- chave anônima (a do navegador) e a autenticada podem executá-las. Nenhuma
-- função da Lupa roda com o privilégio do dono e as chaves não escrevem em
-- nada (#421), então isto não muda o que funciona: é a segunda camada para
-- o dia em que uma `security definer` for criada por engano.
--
-- A aplicação chama toda função pela chave de serviço, que continua
-- executando todas.
--
-- Antes ou depois do deploy, tanto faz. Seguro de rodar mais de uma vez, e
-- precisa rodar de novo depois de qualquer `aplica-*.sql` que crie função.
-- ============================================================================

revoke execute on all functions in schema public
  from public, anon, authenticated;
grant execute on all functions in schema public to service_role;

alter default privileges in schema public
  revoke execute on functions from anon, authenticated;
