-- ============================================================================
-- Denuncias de vaga e avaliacao (#435)
--
-- Cria a tabela onde as denuncias ficam ate o admin decidir, e a funcao
-- que tira do ar e fecha as denuncias do mesmo alvo numa transacao so.
-- Fechada para as chaves anonima e autenticada.
--
-- **Rode antes do deploy.** O botao de denunciar grava aqui; sem a tabela,
-- denunciar falha com erro.
--
-- Seguro de rodar mais de uma vez.
-- ============================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'alvo_denuncia') then
    create type alvo_denuncia as enum ('vaga', 'avaliacao', 'publicacao');
  end if;
  if not exists (select 1 from pg_type where typname = 'motivo_denuncia') then
    create type motivo_denuncia as enum ('golpe', 'falsa', 'ofensiva', 'outro');
  end if;
  if not exists (select 1 from pg_type where typname = 'status_denuncia') then
    create type status_denuncia as enum ('aberta', 'procedente', 'descartada');
  end if;
end $$;

-- A foto de trabalho entrou depois (#452); num banco antigo, o tipo já
-- existe sem ela.
alter type alvo_denuncia add value if not exists 'publicacao';

create table if not exists denuncias (
  id             uuid primary key default gen_random_uuid(),
  alvo           alvo_denuncia not null,
  alvo_id        uuid not null,
  -- Para a avaliação, de quem é o perfil onde ela aparece: é o caminho que
  -- o admin abre para ver o contexto. Nulo na vaga, cujo id já é o caminho.
  prestador_id   uuid references usuarios(id) on delete cascade,
  -- `set null`: a conta anonimizada não é apagada (#423), mas se um dia
  -- for, a denúncia que ela fez continua valendo como sinal.
  denunciante_id uuid references usuarios(id) on delete set null,
  motivo         motivo_denuncia not null,
  detalhe        text check (detalhe is null or char_length(detalhe) <= 500),
  status         status_denuncia not null default 'aberta',
  criada_em      timestamptz not null default now(),
  decidida_em    timestamptz
);

-- Uma denúncia aberta por pessoa e por alvo: a segunda não soma nada, e
-- dez cliques da mesma pessoa não podem parecer dez pessoas.
create unique index if not exists denuncias_uma_aberta_por_pessoa
  on denuncias (alvo, alvo_id, denunciante_id)
  where status = 'aberta' and denunciante_id is not null;

create index if not exists denuncias_abertas_idx
  on denuncias (criada_em)
  where status = 'aberta';

create index if not exists denuncias_denunciante_idx on denuncias (denunciante_id);

alter table denuncias enable row level security;

create or replace function decidir_denuncia(
  p_alvo        alvo_denuncia,
  p_alvo_id     uuid,
  p_tirar_do_ar boolean
)
returns integer
language plpgsql
set search_path = public, pg_temp
as $$
declare
  fechadas integer;
begin
  -- As denúncias primeiro: apagar a avaliação antes levaria junto as
  -- abertas, pelo trigger logo abaixo, e a decisão não ficaria registrada.
  update denuncias
     set status = case when p_tirar_do_ar
                       then 'procedente'::status_denuncia
                       else 'descartada'::status_denuncia end,
         decidida_em = now()
   where alvo = p_alvo
     and alvo_id = p_alvo_id
     and status = 'aberta';

  get diagnostics fechadas = row_count;

  if p_tirar_do_ar then
    if p_alvo = 'vaga' then
      update vagas set status = 'fechada' where id = p_alvo_id;
    elsif p_alvo = 'avaliacao' then
      -- O trigger de `avaliacoes` recalcula a nota do prestador.
      delete from avaliacoes where id = p_alvo_id;
    else
      -- A foto sai de vez, e não arquivada (#452): arquivada, ela seguiria
      -- no ar pelo endereço, e o dono poderia trazê-la de volta. O
      -- arquivo no Storage a aplicação apaga em seguida.
      delete from publicacoes where id = p_alvo_id;
    end if;
  end if;

  return fechadas;
end;
$$;

-- O alvo sumiu — a conta do dono foi excluída (#423), e a vaga e as
-- avaliações do perfil foram junto —, e a denúncia aberta sumiria com ele:
-- sem isso o painel mostraria algo que ninguém consegue mais abrir. As já
-- decididas ficam, como registro.
create or replace function denuncias_somem_com_o_alvo()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  delete from denuncias
   where alvo = tg_argv[0]::alvo_denuncia
     and alvo_id = old.id
     and status = 'aberta';
  return old;
end;
$$;

drop trigger if exists denuncias_da_vaga on vagas;
create trigger denuncias_da_vaga
  after delete on vagas
  for each row execute function denuncias_somem_com_o_alvo('vaga');

drop trigger if exists denuncias_da_avaliacao on avaliacoes;
create trigger denuncias_da_avaliacao
  after delete on avaliacoes
  for each row execute function denuncias_somem_com_o_alvo('avaliacao');

drop trigger if exists denuncias_da_publicacao on publicacoes;
create trigger denuncias_da_publicacao
  after delete on publicacoes
  for each row execute function denuncias_somem_com_o_alvo('publicacao');

revoke select on denuncias from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger
  on denuncias from anon, authenticated;
