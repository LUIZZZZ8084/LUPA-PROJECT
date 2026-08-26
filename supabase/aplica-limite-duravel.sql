-- =============================================================================
-- LUPA — limite de tentativas que sobrevive ao deploy
--
-- Rode UMA VEZ no banco de produção, no SQL Editor do Supabase. Banco novo
-- não precisa: o `schema.sql` já traz tudo isto.
--
-- POR QUE
-- ───────
-- O contador vivia num `Map` em memória da função serverless. Duas
-- consequências que o código não escondia, mas que ninguém tinha medido:
--
--   1. Sumia a cada deploy. Contador zerado é tentativa liberada, e a
--      Vercel publica a cada merge na `main`.
--   2. Valia por instância. Serverless escala horizontalmente; quem caísse
--      noutra instância começava do zero. Com concorrência suficiente, o
--      limite virava sugestão.
--
-- Para o volume de hoje isso era honesto. Deixa de ser no dia em que
-- alguém decidir tentar de verdade — e esse dia não avisa.
--
-- A CORRIDA, QUE É ONDE UM LIMITE FALHA
-- ─────────────────────────────────────
-- Pelo caminho ler-somar-gravar, duas tentativas simultâneas leem "4" e
-- escrevem "5" as duas: a sexta passa. Por isso o registro é uma instrução
-- só, com `on conflict do update` — o banco é o único lugar onde essa
-- corrida não existe. Há teste contra Postgres real disparando cinco
-- tentativas ao mesmo tempo e exigindo que somem cinco.
--
-- O QUE A TABELA GUARDA
-- ─────────────────────
-- Chave, contagem, quando começou e até quando está bloqueada. A chave é
-- `login:<e-mail>` ou `cadastro:<origem>` — nada além do que a própria
-- tentativa já traz —, e a linha morre com a janela.
--
-- Aditivo e repetível.
-- =============================================================================

begin;

create table if not exists tentativas_de_acesso (
  chave         text primary key,
  tentativas    integer not null default 0,
  primeira_em   timestamptz not null default now(),
  bloqueado_ate timestamptz,

  constraint tentativas_nao_negativas check (tentativas >= 0)
);

create index if not exists tentativas_de_acesso_primeira_em_idx
  on tentativas_de_acesso (primeira_em);

create or replace function registrar_falha_de_acesso(
  p_chave             text,
  p_janela_segundos   integer,
  p_max_tentativas    integer,
  p_bloqueio_segundos integer
)
returns timestamptz
language sql
as $$
  insert into tentativas_de_acesso (chave, tentativas, primeira_em)
  values (p_chave, 1, now())
  on conflict (chave) do update set
    tentativas = case
      when now() - tentativas_de_acesso.primeira_em
             > make_interval(secs => p_janela_segundos)
      then 1
      else tentativas_de_acesso.tentativas + 1
    end,
    primeira_em = case
      when now() - tentativas_de_acesso.primeira_em
             > make_interval(secs => p_janela_segundos)
      then now()
      else tentativas_de_acesso.primeira_em
    end,
    bloqueado_ate = case
      when (case
              when now() - tentativas_de_acesso.primeira_em
                     > make_interval(secs => p_janela_segundos)
              then 1
              else tentativas_de_acesso.tentativas + 1
            end) >= p_max_tentativas
      then now() + make_interval(secs => p_bloqueio_segundos)
      else null
    end
  returning bloqueado_ate;
$$;

/*
 * Apaga o que já venceu, e poupa quem ainda está bloqueado.
 *
 * Chamada junto com o registro de falha, e não por rotina agendada: sem
 * cron, a alternativa seria a tabela crescer com toda chave vista uma vez
 * e nunca mais.
 */
create or replace function limpar_tentativas_vencidas(p_janela_segundos integer)
returns void
language sql
as $$
  delete from tentativas_de_acesso
   where primeira_em < now() - make_interval(secs => p_janela_segundos * 4)
     and (bloqueado_ate is null or bloqueado_ate < now());
$$;

alter table tentativas_de_acesso enable row level security;
revoke select on tentativas_de_acesso from anon, authenticated;

commit;

-- ─── Conferência ────────────────────────────────────────────────────────
-- Registra cinco falhas numa chave de teste, confere que a quinta bloqueia
-- e apaga a linha. `bloqueou` deve ser true e `anon_le` false.

select
  (select registrar_falha_de_acesso('teste:conferencia', 900, 5, 900)) is null
    as primeira_nao_bloqueia;

select
  registrar_falha_de_acesso('teste:conferencia', 900, 5, 900) is not null
    as bloqueou_na_quinta
  from generate_series(1, 4) limit 1 offset 3;

delete from tentativas_de_acesso where chave = 'teste:conferencia';

select
  exists (select 1 from information_schema.tables
           where table_name = 'tentativas_de_acesso') as tabela_existe,
  has_table_privilege('anon', 'tentativas_de_acesso', 'SELECT') as anon_le;
