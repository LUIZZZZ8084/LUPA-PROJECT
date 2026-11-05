-- ============================================================================
-- Etiquetas nas candidaturas do funil (#545)
--
-- Uma coluna nova em `acompanhamento_candidatura`, a tabela que já é só da
-- empresa (#539): as etiquetas herdam o `revoke`, a RLS e a cascata dela.
--
-- **Rode antes do deploy**: o código novo lê e grava `etiquetas`, e sem a
-- coluna a ficha, o funil e o painel respondem indisponível. Seguro de rodar
-- mais de uma vez.
-- ============================================================================

begin;

alter table acompanhamento_candidatura
  add column if not exists etiquetas text[] not null default '{}';

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'acompanhamento_candidatura_etiquetas_check'
  ) then
    alter table acompanhamento_candidatura
      add constraint acompanhamento_candidatura_etiquetas_check
      check (cardinality(etiquetas) <= 5);
  end if;
end $$;

commit;

select exists (select 1 from information_schema.columns
  where table_name = 'acompanhamento_candidatura'
    and column_name = 'etiquetas') as coluna_existe;
