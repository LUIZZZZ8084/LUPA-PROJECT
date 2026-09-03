-- =============================================================================
-- LUPA — a avaliação passa a ter dono
--
-- Rode UMA VEZ no banco de produção, no SQL Editor do Supabase. Banco novo
-- não precisa: o `schema.sql` já traz tudo isto.
--
-- PARA QUE SERVE
-- ──────────────
-- `avaliacoes` nasceu com `nome_avaliador` — texto solto, sem ligação com
-- conta nenhuma. Dava para popular o seed, não para receber gente
-- autenticada: sem dono, a mesma pessoa avalia dez vezes, e ninguém
-- consegue mostrar a ela a própria avaliação depois.
--
-- Três garantias entram, e todas moram no banco:
--
--   1. `avaliador_id` — de quem é a avaliação.
--   2. Uma por pessoa por prestador. Na aplicação sozinha não basta: dois
--      envios simultâneos passam os dois pela checagem e gravam os dois.
--   3. Ninguém avalia a si mesmo.
--
-- A coluna é opcional porque as avaliações de demonstração já existem sem
-- dono. O índice é parcial pela mesma razão — nulo não colide com nulo, e
-- as linhas antigas não travam a migração.
--
-- Aditivo e repetível.
-- =============================================================================

begin;

alter table avaliacoes
  add column if not exists avaliador_id uuid references usuarios(id) on delete set null;

-- Uma avaliação por pessoa, por prestador.
create unique index if not exists avaliacoes_um_por_pessoa_idx
  on avaliacoes (prestador_id, avaliador_id)
  where avaliador_id is not null;

/*
 * Ninguém avalia a si mesmo.
 *
 * `not valid` para não reprovar em linha antiga: as de demonstração têm
 * `avaliador_id` nulo e passam pela condição, mas a validação completa
 * varreria a tabela inteira sem necessidade. Novas linhas já são
 * conferidas.
 */
alter table avaliacoes
  drop constraint if exists avaliacao_nao_e_de_si_mesmo;

alter table avaliacoes
  add constraint avaliacao_nao_e_de_si_mesmo
  check (avaliador_id is null or avaliador_id <> prestador_id) not valid;

commit;

-- ─── Conferência ────────────────────────────────────────────────────────
-- Os três devem vir true.

select
  exists (
    select 1 from information_schema.columns
     where table_name = 'avaliacoes' and column_name = 'avaliador_id'
  ) as coluna_existe,
  exists (
    select 1 from pg_indexes
     where tablename = 'avaliacoes'
       and indexname = 'avaliacoes_um_por_pessoa_idx'
  ) as indice_existe,
  exists (
    select 1 from pg_constraint
     where conname = 'avaliacao_nao_e_de_si_mesmo'
  ) as trava_de_auto_avaliacao;
