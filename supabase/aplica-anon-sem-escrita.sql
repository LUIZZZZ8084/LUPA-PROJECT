-- ============================================================================
-- A chave anonima nao escreve em nada (#421)
--
-- O Supabase concede a `anon` e `authenticated`, por padrao, todas as
-- permissoes nas tabelas e views do schema publico: insert, update, delete,
-- truncate, references e trigger, alem do select. O schema.sql ja revogava o
-- select do que nao e publico; a escrita ficava concedida em 32 relacoes.
--
-- A aplicacao nunca escreve com essa chave: toda escrita e toda chamada de
-- funcao usam a chave de servico. Hoje o RLS, sem policy de escrita, e o que
-- barra; isto e a segunda camada, a mesma que o `revoke select` ja e para a
-- leitura.
--
-- O select das relacoes publicas nao e tocado. O `alter default privileges`
-- vale para as tabelas que o papel que roda este arquivo criar depois.
--
-- Antes ou depois do deploy, tanto faz. Seguro de rodar mais de uma vez.
-- ============================================================================

revoke insert, update, delete, truncate, references, trigger
  on all tables in schema public from anon, authenticated;

alter default privileges in schema public
  revoke insert, update, delete, truncate, references, trigger
  on tables from anon, authenticated;
