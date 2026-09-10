-- ============================================================================
-- O caixa do painel: o que entrou e o que saiu (#179)
--
-- O bloco de faturamento em /admin/painel mostrava "assinaturas ativas",
-- "em teste" e uma receita estimada. Os tres numeros vinham da view
-- `metricas_planos`, que agrega `perfis_empresa.plano` — a coluna que o
-- AGENTS.md cita como exemplo de estado declarado sem produtor: nasceu no
-- schema e **nada nunca escreveu nela**. `mensal` era sempre zero, `trial`
-- contava todas as empresas, e a receita era zero vezes um preco.
--
-- Decisao do Luiz em 10/09/2026: todo valor que entra deve ser registrado,
-- e o que sai tambem. A fonte passa a ser `pagamentos`, que e por onde o
-- dinheiro de verdade passa.
--
-- Junto vem a separacao das duas saidas. Ate aqui `refunded` e
-- `charged_back` caiam os dois em `estornado`, porque o efeito no app e o
-- mesmo — a mensalidade cai, os creditos voltam. Mas o efeito e o que eles
-- tem em comum, nao o que eles sao: chargeback custa taxa do Mercado Pago,
-- e sinal de fraude ou de compra nao reconhecida, e da para contestar de
-- volta. A informacao chega uma vez so, no webhook, e some se nao for
-- gravada ali.
--
-- **Nenhuma linha e reclassificada, e nao ha o que reclassificar:** hoje
-- nao existe nenhum pagamento estornado em producao. Se existisse, ficaria
-- como `estornado` — nao ha como saber, depois do fato, qual saida foi
-- qual, e chutar seria pior que admitir a lacuna.
--
-- Idempotente: roda de novo sem erro num banco que ja tem tudo isto.
-- ============================================================================

-- Fora da transacao de proposito: em Postgres um valor recem-acrescentado
-- nao pode ser *usado* na mesma transacao em que nasceu, e a view abaixo o
-- usa num `filter`.
do $$
begin
  if not exists (
    select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
    where t.typname = 'status_pagamento' and e.enumlabel = 'contestado'
  ) then
    alter type status_pagamento add value 'contestado';
  end if;
end
$$;

begin;

/*
 * A view antiga sai junto.
 *
 * Deixa-la ao lado da nova seria manter duas respostas para a mesma
 * pergunta, e a errada e a que ja esta cabeada no painel. Coluna e view
 * sem produtor sao a mesma armadilha — some com as duas de uma vez.
 *
 * `perfis_empresa.plano` em si fica por ora: derrubar a coluna e outra
 * decisao, e ela nao faz mal enquanto ninguem a le.
 */
drop view if exists metricas_planos;

create or replace view metricas_caixa
with (security_invoker = false) as
select
  coalesce(sum(valor_centavos) filter (where status = 'aprovado'), 0)
    as entrou_centavos,
  coalesce(sum(valor_centavos) filter (where status = 'estornado'), 0)
    as estornado_centavos,
  coalesce(sum(valor_centavos) filter (where status = 'contestado'), 0)
    as contestado_centavos,
  coalesce(sum(valor_centavos) filter (
    where status = 'aprovado'
      and tipo in ('prestador_mensalidade', 'empresa_mensal')
  ), 0) as recorrente_centavos,
  count(*) filter (where status = 'aprovado')    as cobrancas,
  count(*) filter (where status = 'contestado')  as contestacoes
from pagamentos;

/*
 * O Supabase concede `select` a `anon` e `authenticated` por padrao nas
 * views do schema publico — view nova nasce legivel. Isto aqui e o caixa
 * da empresa; nao vai para o navegador de ninguem.
 */
revoke select on metricas_caixa from anon, authenticated;

commit;

-- ─── Conferência ────────────────────────────────────────────────────────
select
  exists (select 1 from information_schema.views
    where table_name = 'metricas_caixa') as view_nova_existe,
  not exists (select 1 from information_schema.views
    where table_name = 'metricas_planos') as view_velha_saiu,
  exists (select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
    where t.typname = 'status_pagamento'
      and e.enumlabel = 'contestado') as contestado_existe,
  not exists (select 1 from information_schema.table_privileges
    where table_name = 'metricas_caixa'
      and grantee in ('anon', 'authenticated')
      and privilege_type = 'SELECT') as caixa_fechado_para_anon,
  (select entrou_centavos from metricas_caixa) as entrou_centavos;
