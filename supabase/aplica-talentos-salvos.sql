-- ============================================================================
-- Talentos salvos (#618)
--
-- Quem a empresa guardou para uma próxima vaga, uma linha por empresa e por
-- pessoa. Só a chave de serviço alcança.
--
-- Quem já tinha a etiqueta "banco de talentos" (#545) numa candidatura entra
-- salvo: era o jeito que a empresa tinha de dizer a mesma coisa.
--
-- **Rode antes do deploy**: a ficha lê esta tabela. Seguro de rodar mais de
-- uma vez.
-- ============================================================================

begin;

create table if not exists talentos_salvos (
  empresa_id   uuid not null references usuarios(id) on delete cascade,
  candidato_id uuid not null references usuarios(id) on delete cascade,
  salvo_em     timestamptz not null default now(),

  primary key (empresa_id, candidato_id),
  constraint talento_nao_e_a_propria_empresa check (empresa_id <> candidato_id)
);

create index if not exists talentos_salvos_candidato_idx
  on talentos_salvos (candidato_id);

alter table talentos_salvos enable row level security;

revoke all on talentos_salvos from anon, authenticated;

insert into talentos_salvos (empresa_id, candidato_id)
select distinct v.empresa_id, c.candidato_id
  from acompanhamento_candidatura a
  join candidaturas c on c.id = a.candidatura_id
  join vagas v on v.id = c.vaga_id
 where 'banco de talentos' = any (a.etiquetas)
   and v.empresa_id <> c.candidato_id
on conflict do nothing;

commit;

-- ─── Conferência ────────────────────────────────────────────────────────
-- `tabela_existe` true; `anon_le` false; `salvos` quantos entraram.
select
  exists (select 1 from information_schema.tables
    where table_name = 'talentos_salvos') as tabela_existe,
  has_table_privilege('anon', 'talentos_salvos', 'SELECT') as anon_le,
  (select count(*) from talentos_salvos) as salvos;
