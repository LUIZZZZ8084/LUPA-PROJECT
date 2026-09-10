-- ============================================================================
-- Recuperação de senha (#174)
--
-- A migração `0001` trocou o Supabase Auth por autenticação própria, e o
-- `AGENTS.md` registra desde então o que se perdeu junto: verificação de
-- e-mail e recuperação de senha, que vinham de graça. Esta tabela é a
-- segunda metade dessa dívida.
--
-- **O token nunca é guardado em claro.** Quem lesse esta tabela — um
-- backup exposto, um acesso de leitura mal concedido — poderia trocar a
-- senha de qualquer conta. Guarda-se o SHA-256 dele; o valor original só
-- existe no e-mail que a pessoa recebeu.
--
-- SHA-256 e não Argon2 de propósito: Argon2 é caro justamente para
-- resistir a força bruta contra senha de gente, que tem pouca entropia.
-- Aqui o segredo é aleatório de 256 bits — não há o que adivinhar, e o
-- custo por tentativa não compra nada.
--
-- Idempotente: roda de novo sem erro num banco que já tem tudo isto.
-- ============================================================================

begin;

create table if not exists tokens_recuperacao (
  id         uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references usuarios(id) on delete cascade,
  token_hash text not null unique,
  expira_em  timestamptz not null,
  usado_em   timestamptz,
  criado_em  timestamptz not null default now()
);

create index if not exists tokens_recuperacao_usuario_idx
  on tokens_recuperacao (usuario_id, criado_em desc);

alter table tokens_recuperacao enable row level security;

/*
 * O Supabase concede `select` a `anon` e `authenticated` por padrão nas
 * tabelas do schema público: tabela nova nasce legível mesmo com RLS
 * ligada. Aqui isso seria a chave de trocar a senha de qualquer conta.
 */
revoke select on tokens_recuperacao from anon, authenticated;

commit;

-- ─── Conferência ────────────────────────────────────────────────────────
select
  exists (select 1 from information_schema.tables
    where table_name = 'tokens_recuperacao') as tabela_existe,
  not exists (select 1 from information_schema.table_privileges
    where table_name = 'tokens_recuperacao'
      and grantee in ('anon', 'authenticated')
      and privilege_type = 'SELECT') as fechada_para_anon;
