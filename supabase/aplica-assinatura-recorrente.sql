-- ============================================================================
-- Renovação automática — `preapproval` do Mercado Pago (#170)
--
-- Até aqui a cobrança era avulsa: o prestador pagava R$ 19,90, ganhava 30
-- dias, e no dia 31 sumia da vitrine sem cobrança nova e sem aviso. Ninguém
-- renovava sozinho — nem o app, nem a pessoa, que não tinha motivo para
-- lembrar de uma data que nada avisava.
--
-- `assinaturas` guarda a autorização que o Mercado Pago usa para cobrar
-- todo mês, e `pagamentos.assinatura_id` liga cada parcela à autorização
-- que a gerou. Sem grant para `anon`/`authenticated`, como `pagamentos`:
-- é dado financeiro, e só o servidor precisa alcançar.
--
-- Idempotente: roda de novo sem erro num banco que já tem tudo isto.
-- ============================================================================

begin;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'status_assinatura') then
    create type status_assinatura as enum
      ('pendente', 'ativa', 'pausada', 'cancelada');
  end if;
end
$$;

create table if not exists assinaturas (
  id                 uuid primary key default gen_random_uuid(),
  usuario_id         uuid not null references usuarios(id) on delete cascade,
  tipo               tipo_pagamento not null,
  valor_centavos     int not null check (valor_centavos > 0),
  status             status_assinatura not null default 'pendente',
  mp_preapproval_id  text,
  checkout_url       text,
  criado_em          timestamptz not null default now(),
  atualizado_em      timestamptz not null default now()
);

create index if not exists assinaturas_usuario_idx
  on assinaturas (usuario_id, criado_em desc);

/*
 * Uma linha por assinatura do Mercado Pago. Não há índice único por
 * pessoa de propósito: a garantia de "uma viva por vez" é da aplicação,
 * porque uma violação de unicidade aqui aconteceria dentro do webhook — e
 * webhook que responde 500 é webhook que o Mercado Pago reenvia para
 * sempre.
 */
create unique index if not exists assinaturas_mp_idx
  on assinaturas (mp_preapproval_id) where mp_preapproval_id is not null;

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'assinaturas_atualizado_em'
  ) then
    create trigger assinaturas_atualizado_em
      before update on assinaturas
      for each row execute function tocar_atualizado_em();
  end if;
end
$$;

alter table assinaturas enable row level security;

/*
 * O Supabase concede `select` a `anon` e `authenticated` por padrão nas
 * tabelas do schema público: tabela nova nasce legível mesmo com RLS
 * ligada. A RLS sem policy já nega tudo; o `revoke` é a segunda camada,
 * para o dia em que alguém criar uma policy por engano. Mesmo buraco que
 * `preferencias_notificacao` e `inscricoes_push` tiveram em produção.
 */
revoke select on assinaturas from anon, authenticated;

-- A parcela sabe de qual autorização veio. `on delete set null` porque a
-- cobrança aconteceu de verdade e não some junto com a autorização.
alter table pagamentos
  add column if not exists assinatura_id uuid
  references assinaturas(id) on delete set null;

/*
 * E sai a preferência do Checkout Pro.
 *
 * O modelo avulso deixou de existir com a recorrência: nada mais cria
 * preferência, e uma coluna que nenhum caminho preenche é a mesma
 * armadilha do valor de enum sem produtor — parece que alguém guarda
 * aquilo, e ninguém guarda. Vaga avulsa e plano de empresa, quando
 * tiverem tela, trazem a coluna de volta junto com o código que a
 * escreve.
 */
alter table pagamentos drop column if exists mp_preference_id;

commit;

-- ─── Conferência ────────────────────────────────────────────────────────
select
  exists (select 1 from information_schema.tables
    where table_name = 'assinaturas') as tabela_existe,
  exists (select 1 from pg_type where typname = 'status_assinatura') as enum_existe,
  exists (select 1 from information_schema.columns
    where table_name = 'pagamentos'
      and column_name = 'assinatura_id') as coluna_na_cobranca,
  -- `anon`/`authenticated` não podem ler assinaturas.
  not exists (select 1 from information_schema.table_privileges
    where table_name = 'assinaturas'
      and grantee in ('anon', 'authenticated')
      and privilege_type = 'SELECT') as assinaturas_fechado_para_anon;
