-- =============================================================================
-- LUPA — buscas que não acharam nada
--
-- Rode UMA VEZ no banco de produção, no SQL Editor do Supabase. Banco novo
-- não precisa: o `schema.sql` já traz tudo isto.
--
-- PARA QUE SERVE
-- ──────────────
-- Responder uma pergunta que hoje é palpite: vale ampliar a tabela de
-- sinônimos em `src/lib/skills.ts`, ou o vocabulário é variado demais e a
-- busca precisa virar semântica?
--
-- Busca vetorial custa dinheiro por consulta, latência numa tela que abre
-- em 3G, e uma dependência externa no caminho crítico. Decisão desse
-- tamanho merece um mês de dado antes.
--
-- O QUE NÃO SE GUARDA
-- ───────────────────
-- Quem buscou. Nem id, nem sessão, nem endereço — a tabela tem quatro
-- colunas e nenhuma liga o termo a uma pessoa.
--
-- Histórico de busca de quem procura emprego é a mesma classe de
-- informação que o currículo: numa cidade do tamanho de Sinop, saber que
-- alguém pesquisou "vaga de motorista" três vezes esta semana diz que essa
-- pessoa quer sair do emprego atual.
--
-- Uma linha por termo por dia por tela, incrementada — a mesma forma das
-- visualizações, pelo mesmo motivo: o que se usa é o agregado, e uma linha
-- por busca faria a tabela crescer com o tráfego em vez de com o
-- vocabulário.
--
-- Aditivo e repetível.
-- =============================================================================

begin;

create table if not exists buscas_sem_resultado (
  termo  text not null,
  dia    date not null default current_date,
  onde   text not null,
  total  integer not null default 0,

  primary key (termo, dia, onde),
  constraint total_nao_negativo check (total >= 0),
  constraint onde_conhecido check (onde in ('vagas', 'servicos')),
  constraint termo_com_tamanho check (length(termo) between 2 and 80)
);

create index if not exists buscas_sem_resultado_dia_idx
  on buscas_sem_resultado (dia desc);

/*
 * Incremento atômico.
 *
 * Duas pessoas buscando o mesmo termo no mesmo segundo pelo caminho
 * ler-somar-gravar perderiam uma contagem — e num termo raro, que é
 * justamente o que interessa aqui, perder uma é perder metade do sinal.
 */
create or replace function registrar_busca_sem_resultado(
  p_termo text,
  p_onde  text
)
returns void
language sql
as $$
  insert into buscas_sem_resultado (termo, dia, onde, total)
  values (p_termo, current_date, p_onde, 1)
  on conflict (termo, dia, onde)
  do update set total = buscas_sem_resultado.total + 1;
$$;

alter table buscas_sem_resultado enable row level security;
revoke select on buscas_sem_resultado from anon, authenticated;

commit;

-- ─── Conferência ────────────────────────────────────────────────────────
-- `colunas` deve ser exatamente {dia,onde,termo,total} — nenhuma que ligue
-- o termo a uma pessoa. `rls_ligada` true, `anon_le` false.

select
  (select array_agg(column_name order by column_name)
     from information_schema.columns
    where table_name = 'buscas_sem_resultado') as colunas,
  (select relrowsecurity from pg_class
    where relname = 'buscas_sem_resultado') as rls_ligada,
  has_table_privilege('anon', 'buscas_sem_resultado', 'SELECT') as anon_le;
