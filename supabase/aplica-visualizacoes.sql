-- =============================================================================
-- LUPA — visualizações de vaga em banco que já existe
--
-- Rode UMA VEZ no banco de produção, no SQL Editor do Supabase. Banco novo
-- não precisa: o `schema.sql` já traz tudo isto.
--
-- Por que existe um arquivo separado: `schema.sql` é escrito para rodar de
-- uma vez num banco limpo e é a fonte da verdade do que o banco deveria
-- ser. Rodá-lo inteiro num banco com dados falharia no primeiro `create
-- type` — e, se alguém "resolvesse" isso pondo `drop` no topo, apagaria a
-- produção no dia em que abrisse o arquivo errado.
--
-- Sem isto aplicado, `registrar_visualizacao()` não existe: a contagem
-- falha e vai para o log, o gráfico do painel fica em zero, e a página da
-- vaga continua abrindo normalmente. É degradação, não queda.
--
-- Tudo aqui é aditivo e repetível: rodar duas vezes não muda o resultado
-- nem toca em dado existente.
-- =============================================================================

create table if not exists visualizacoes_vaga (
  vaga_id uuid not null references vagas(id) on delete cascade,
  dia     date not null default current_date,
  total   integer not null default 0,

  primary key (vaga_id, dia),
  constraint total_nao_negativo check (total >= 0)
);

-- A consulta do painel é sempre "as vagas desta empresa, últimos N dias".
create index if not exists visualizacoes_vaga_dia_idx
  on visualizacoes_vaga (dia);

/*
 * Incremento atômico.
 *
 * Duas visitas simultâneas fariam duas leituras iguais e duas escritas do
 * mesmo valor pelo caminho ler-somar-gravar — uma delas se perderia. O
 * `on conflict do update` resolve no banco, que é o único lugar onde essa
 * corrida não existe.
 */
create or replace function registrar_visualizacao(p_vaga_id uuid)
returns void
language sql
as $$
  insert into visualizacoes_vaga (vaga_id, dia, total)
  values (p_vaga_id, current_date, 1)
  on conflict (vaga_id, dia)
  do update set total = visualizacoes_vaga.total + 1;
$$;

/*
 * Fechada para o navegador.
 *
 * A série é dado de negócio da empresa: quantas pessoas abriram cada vaga,
 * em que dia. Com RLS ligada e nenhuma policy, a chave anônima não lê nada
 * — e o `revoke` garante que criar uma policy por engano no futuro não
 * abra a tabela sozinho. Quem lê é o servidor, com a chave de serviço.
 */
alter table visualizacoes_vaga enable row level security;
revoke select on visualizacoes_vaga from anon, authenticated;

-- Confere o que ficou. Deve devolver uma linha, com `rls_ligada` = true.
select
  c.relname                                      as tabela,
  c.relrowsecurity                               as rls_ligada,
  has_function_privilege('registrar_visualizacao(uuid)', 'execute') as funcao_ok
from pg_class c
where c.relname = 'visualizacoes_vaga';
