-- ============================================================================
-- O ranking de buscas sem resultado, somado no banco (#585)
--
-- Uma view que soma por termo os últimos 30 dias, só da chave de serviço.
-- O painel do admin passa a ler dela, já ordenada.
--
-- **Rode antes do deploy**: o painel lê a view nova. Seguro de rodar mais
-- de uma vez.
-- ============================================================================

begin;
/*
 * O ranking do painel, somado aqui (#585).
 *
 * Era somado na aplicação depois de ler um teto de linhas sem ordem: com
 * mais linhas que o teto, o ranking saía de uma amostra qualquer. Somado e
 * ordenado no banco, o teto passa a cortar o resultado, e não a entrada.
 * A janela é a do painel: os últimos 30 dias.
 */
create or replace view metricas_buscas_sem_resultado
with (security_invoker = false) as
select termo, sum(total)::int as total
from buscas_sem_resultado
where dia >= current_date - 29
group by termo;

revoke all on metricas_buscas_sem_resultado from anon, authenticated;

commit;

select exists (select 1 from information_schema.views
  where table_name = 'metricas_buscas_sem_resultado') as view_existe;
