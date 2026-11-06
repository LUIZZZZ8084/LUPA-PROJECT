-- ============================================================================
-- O registro das varreduras e as visitas da página para empresas (#566, #568)
--
-- Duas tabelas pequenas para o painel do admin:
--
-- `execucoes_varredura` — uma linha por varredura agendada, sobrescrita a
-- cada execução. Diz se a de hoje rodou; o histórico fica na Vercel.
--
-- `visitas_pagina` — uma linha por página por dia, incrementada. Hoje só a
-- página para empresas, e nada que diga quem visitou.
--
-- **Rode antes do deploy**: as rotas de cron e a página para empresas
-- passam a gravar aqui. Se rodar depois, nada quebra — a gravação falha em
-- silêncio e só aparece no log —, mas o painel fica sem o dado até lá.
-- Seguro de rodar mais de uma vez.
-- ============================================================================

begin;

create table if not exists visitas_pagina (
  pagina text not null,
  dia    date not null default current_date,
  total  integer not null default 0,

  primary key (pagina, dia),
  constraint total_nao_negativo check (total >= 0),
  constraint pagina_conhecida check (pagina in ('para_empresas'))
);

create or replace function registrar_visita_pagina(p_pagina text)
returns void
language sql
set search_path = public, pg_temp
as $$
  insert into visitas_pagina (pagina, dia, total)
  values (p_pagina, current_date, 1)
  on conflict (pagina, dia)
  do update set total = visitas_pagina.total + 1;
$$;

create table if not exists execucoes_varredura (
  nome          text primary key,
  rodou_em      timestamptz not null,
  ok            boolean not null,
  resumo        jsonb not null default '{}'::jsonb,
  ultima_ok_em  timestamptz,

  constraint varredura_conhecida
    check (nome in ('reconciliar-pagamentos', 'avisar-vagas-vencendo'))
);

alter table visitas_pagina      enable row level security;
alter table execucoes_varredura enable row level security;

-- Só a chave de serviço: nem leitura, nem escrita pelas chaves do navegador
-- (#421), e a função só por ela (#449).
revoke all on visitas_pagina      from anon, authenticated;
revoke all on execucoes_varredura from anon, authenticated;
revoke execute on function registrar_visita_pagina(text)
  from public, anon, authenticated;

commit;

-- ─── Conferência ────────────────────────────────────────────────────────
-- As duas `true`, e `anon_le` false.
select
  exists (select 1 from information_schema.tables
    where table_name = 'visitas_pagina')       as visitas_existe,
  exists (select 1 from information_schema.tables
    where table_name = 'execucoes_varredura')  as varreduras_existe,
  has_table_privilege('anon', 'execucoes_varredura', 'SELECT') as anon_le;
