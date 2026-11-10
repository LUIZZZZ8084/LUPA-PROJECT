-- ============================================================================
-- Etapas Contatado e Contratado, e o histórico de cada candidatura (#608)
--
-- Dois valores novos no estágio da candidatura — nenhuma candidatura
-- existente muda — e uma tabela nova, só da empresa, com cada mudança de
-- estágio e cada contato registrado. `mover_candidatura` move e grava o
-- histórico na mesma instrução.
--
-- **Rode antes do deploy**: mover de estágio passa a chamar a função, e sem
-- ela a mudança responde indisponível. Seguro de rodar mais de uma vez.
--
-- Os `alter type` ficam fora do `begin`: valor novo de enum só pode ser
-- usado depois de confirmado.
-- ============================================================================

alter type status_candidatura add value if not exists 'contatada' after 'visualizada';
alter type status_candidatura add value if not exists 'contratada' after 'aprovada';

begin;

create table if not exists historico_candidatura (
  id             uuid primary key default gen_random_uuid(),
  candidatura_id uuid not null references candidaturas(id) on delete cascade,
  tipo           text not null check (tipo in ('etapa', 'contato')),
  de             status_candidatura,
  para           status_candidatura,
  nota           text check (nota is null or char_length(nota) <= 500),
  autor_id       uuid references usuarios(id) on delete set null,
  criado_em      timestamptz not null default now(),

  -- Etapa tem de e para; contato tem nota.
  constraint historico_coerente check (
    (tipo = 'etapa' and de is not null and para is not null and de <> para)
    or (tipo = 'contato' and nota is not null and char_length(btrim(nota)) > 0)
  )
);

create index if not exists historico_candidatura_idx
  on historico_candidatura (candidatura_id, criado_em desc);
create index if not exists historico_candidatura_autor_idx
  on historico_candidatura (autor_id) where autor_id is not null;

alter table historico_candidatura enable row level security;

create or replace function mover_candidatura(
  p_id uuid,
  p_status status_candidatura,
  p_autor uuid
)
returns setof candidaturas
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_de status_candidatura;
begin
  select status into v_de from candidaturas where id = p_id for update;
  if not found then
    return;
  end if;

  if v_de <> p_status then
    update candidaturas set status = p_status where id = p_id;
    insert into historico_candidatura (candidatura_id, tipo, de, para, autor_id)
    values (p_id, 'etapa', v_de, p_status, p_autor);
  end if;

  return query select * from candidaturas where id = p_id;
end;
$$;

-- Só a chave de serviço: nem leitura, nem escrita pelas chaves do navegador
-- (#421), e a função só por ela (#449).
revoke all on historico_candidatura from anon, authenticated;
revoke execute on function mover_candidatura(uuid, status_candidatura, uuid)
  from public, anon, authenticated;
grant execute on function mover_candidatura(uuid, status_candidatura, uuid)
  to service_role;

commit;

-- ─── Conferência ────────────────────────────────────────────────────────
-- `estagios` com os sete, na ordem; `tabela_existe` true; os outros false.
select
  (select array_agg(enumlabel order by enumsortorder) from pg_enum
    where enumtypid = 'status_candidatura'::regtype) as estagios,
  exists (select 1 from information_schema.tables
    where table_name = 'historico_candidatura') as tabela_existe,
  has_table_privilege('anon', 'historico_candidatura', 'SELECT') as anon_le,
  has_function_privilege('anon',
    'mover_candidatura(uuid, status_candidatura, uuid)', 'EXECUTE') as anon_executa;
