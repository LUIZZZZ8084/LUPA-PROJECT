-- ============================================================================
-- De onde a conta veio: a página para empresas (#559)
--
-- Uma coluna nova em `usuarios`, e a contagem no fim de `metricas_totais`.
-- Só o clique na página, nenhum dado novo de quem se cadastrou.
--
-- **Rode antes do deploy**: o cadastro novo grava `veio_de`, e o painel do
-- admin lê a coluna nova da view. Seguro de rodar mais de uma vez.
-- ============================================================================

begin;

alter table usuarios add column if not exists veio_de text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'usuarios_veio_de_check'
  ) then
    alter table usuarios add constraint usuarios_veio_de_check
      check (veio_de is null or veio_de = 'para_empresas');
  end if;
end $$;

create or replace view metricas_totais
with (security_invoker = false) as
with contas as (
  select papel, veio_de from usuarios
  where papel <> 'admin' and senha_hash <> '!conta-excluida'
)
select
  (select count(*) from contas)                                     as usuarios,
  (select count(*) from contas where papel = 'candidato_clt')       as candidatos,
  (select count(*) from contas where papel = 'prestador_servico')   as prestadores,
  (select count(*) from contas where papel = 'empresa')             as empresas,
  (select count(*) from vagas
     where status = 'aberta' and expira_em > now())                 as vagas_abertas,
  -- Por último, a regra do `create or replace view` (#559).
  (select count(*) from contas where veio_de = 'para_empresas')     as pela_pagina_de_empresas;

-- A view continua só da chave de serviço.
revoke select on metricas_totais from anon, authenticated;

commit;

select
  exists (select 1 from information_schema.columns
    where table_name = 'usuarios' and column_name = 'veio_de') as coluna_existe,
  exists (select 1 from information_schema.columns
    where table_name = 'metricas_totais'
      and column_name = 'pela_pagina_de_empresas') as view_expoe;
