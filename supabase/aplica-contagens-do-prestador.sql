-- ============================================================================
-- Visitas e chamadas do perfil do prestador (#604)
--
-- Uma linha por prestador por dia: visitas ao perfil e cliques em
-- "Conversar no WhatsApp". Nada que diga quem visitou ou chamou.
--
-- **Rode antes do deploy**: o perfil e o botão do WhatsApp passam a gravar
-- aqui. Se rodar depois, nada quebra — a contagem falha em silêncio e só
-- aparece no log —, mas o prestador vê zero até lá. Seguro de rodar mais de
-- uma vez.
-- ============================================================================

begin;

create table if not exists contagens_prestador (
  prestador_id uuid not null references usuarios(id) on delete cascade,
  dia          date not null default current_date,
  visitas      integer not null default 0,
  contatos     integer not null default 0,

  primary key (prestador_id, dia),
  constraint contagens_nao_negativas check (visitas >= 0 and contatos >= 0)
);

create or replace function registrar_contagem_prestador(
  p_prestador uuid,
  p_evento text
)
returns void
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if p_evento not in ('visita', 'contato') then
    raise exception 'evento desconhecido: %', p_evento;
  end if;

  insert into contagens_prestador (prestador_id, dia, visitas, contatos)
  values (
    p_prestador,
    current_date,
    (p_evento = 'visita')::int,
    (p_evento = 'contato')::int
  )
  on conflict (prestador_id, dia) do update set
    visitas  = contagens_prestador.visitas  + excluded.visitas,
    contatos = contagens_prestador.contatos + excluded.contatos;
end;
$$;

alter table contagens_prestador enable row level security;

-- Só a chave de serviço: nem leitura, nem escrita pelas chaves do navegador
-- (#421), e a função só por ela (#449).
revoke all on contagens_prestador from anon, authenticated;
revoke execute on function registrar_contagem_prestador(uuid, text)
  from public, anon, authenticated;
grant execute on function registrar_contagem_prestador(uuid, text)
  to service_role;

commit;

-- ─── Conferência ────────────────────────────────────────────────────────
-- `tabela_existe` true; `anon_le` e `anon_executa` false.
select
  exists (select 1 from information_schema.tables
    where table_name = 'contagens_prestador') as tabela_existe,
  has_table_privilege('anon', 'contagens_prestador', 'SELECT') as anon_le,
  has_function_privilege('anon',
    'registrar_contagem_prestador(uuid, text)', 'EXECUTE') as anon_executa;
