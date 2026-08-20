-- ============================================================================
-- 0003 — Views de métrica do painel administrativo
--
-- O painel recarrega a cada poucos segundos. Deixar o Postgres agregar e
-- devolver dezenas de linhas é muito mais barato do que trazer todos os
-- usuários para somar em JavaScript — e continua barato quando a base
-- crescer.
--
-- São views comuns, não materializadas: no volume de uma cidade-piloto, o
-- custo é irrelevante e o dado sai sempre atual. Se um dia pesar, virar
-- materialized view com refresh periódico é uma troca de uma palavra.
-- ============================================================================

begin;

create or replace view metricas_totais
with (security_invoker = true) as
select
  (select count(*) from usuarios where papel <> 'admin')            as usuarios,
  (select count(*) from usuarios where papel = 'candidato_clt')     as candidatos,
  (select count(*) from usuarios where papel = 'prestador_servico') as prestadores,
  (select count(*) from usuarios where papel = 'empresa')           as empresas,
  (select count(*) from jobs where status = 'aberta')               as vagas_abertas;

create or replace view metricas_cadastros_por_dia
with (security_invoker = true) as
select
  (criado_em at time zone 'America/Cuiaba')::date as dia,
  papel,
  count(*) as total
from usuarios
where papel <> 'admin'
group by 1, 2;

-- Fuso de Cuiabá, e não UTC: um cadastro às 21h em Sinop precisa contar no
-- dia em que a pessoa se cadastrou, não no dia seguinte.

create or replace view metricas_por_local
with (security_invoker = true) as
select
  cidade,
  bairro,
  count(*) as total
from usuarios
where papel <> 'admin'
group by cidade, bairro;

create or replace view metricas_planos
with (security_invoker = true) as
select
  count(*) filter (where plano = 'mensal') as mensal,
  count(*) filter (where plano = 'trial')  as trial
from perfis_empresa;

commit;
