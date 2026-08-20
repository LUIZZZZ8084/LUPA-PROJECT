-- ============================================================================
-- 0002 — Publicações de perfil
--
-- Empresas e prestadores publicam conteúdo no próprio perfil: novidade,
-- serviço, foto de trabalho concluído. É o que dá o que ver a quem visita um
-- perfil e ainda não decidiu contratar.
--
-- Limite de 10 publicações ATIVAS por perfil nesta fase. Arquivar libera
-- vaga sem apagar histórico.
-- ============================================================================

begin;

create type status_publicacao as enum ('ativa', 'arquivada');

create table publicacoes (
  id           uuid primary key default gen_random_uuid(),
  autor_id     uuid not null references usuarios(id) on delete cascade,
  titulo       text not null,
  corpo        text not null,
  imagem_url   text,
  status       status_publicacao not null default 'ativa',
  criado_em    timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),

  constraint titulo_com_conteudo check (length(trim(titulo)) between 3 and 120),
  constraint corpo_com_conteudo  check (length(trim(corpo)) between 10 and 3000)
);

create index publicacoes_autor_idx on publicacoes (autor_id, status, criado_em desc);

create trigger publicacoes_atualizado_em
  before update on publicacoes
  for each row execute function tocar_atualizado_em();

-- ----------------------------------------------------------------------------
-- O limite mora no banco
--
-- A aplicação também confere, para dar mensagem decente antes de tentar
-- gravar. Mas a regra de verdade fica aqui: duas requisições simultâneas
-- passariam pela checagem da aplicação e criariam a décima primeira. O
-- banco é o único lugar onde essa corrida não existe.
-- ----------------------------------------------------------------------------

create or replace function conferir_limite_publicacoes()
returns trigger
language plpgsql
as $$
declare
  ativas int;
  limite constant int := 10;
begin
  if new.status <> 'ativa' then
    return new;
  end if;

  -- FOR UPDATE serializa as inserções concorrentes do mesmo autor.
  select count(*) into ativas
  from publicacoes
  where autor_id = new.autor_id
    and status = 'ativa'
    and (tg_op = 'INSERT' or id <> new.id)
  for update;

  if ativas >= limite then
    raise exception 'limite de % publicações ativas atingido', limite
      using errcode = 'check_violation',
            hint = 'arquive uma publicação antiga para abrir espaço';
  end if;

  return new;
end;
$$;

create trigger publicacoes_limite
  before insert or update of status on publicacoes
  for each row execute function conferir_limite_publicacoes();

-- ----------------------------------------------------------------------------
-- Segurança
-- ----------------------------------------------------------------------------

alter table publicacoes enable row level security;

-- Publicação ativa é conteúdo de perfil público: quem visita precisa ver.
create policy "publicacoes ativas sao publicas"
  on publicacoes for select
  using (status = 'ativa');

create policy "autor le as proprias, inclusive arquivadas"
  on publicacoes for select
  using (
    autor_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'sub')::uuid
  );

create policy "autor gerencia as proprias"
  on publicacoes for all
  using (
    autor_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'sub')::uuid
  )
  with check (
    autor_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'sub')::uuid
  );

commit;
