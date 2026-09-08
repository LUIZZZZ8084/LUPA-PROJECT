-- ============================================================================
-- Infraestrutura de cobrança (Mercado Pago) + mensalidade de prestador
--
-- `pagamentos` guarda toda cobrança que a Lupa cria, avulsa ou recorrente.
-- Sem grant para `anon`/`authenticated` — mesmo tratamento de `usuarios`,
-- porque é dado financeiro e só o servidor, com a chave de serviço, precisa
-- alcançar.
--
-- O tipo nasce só com 'prestador_mensalidade', o primeiro uso real: vaga
-- avulsa, planos de empresa e o gerador de currículo pago ganham o próprio
-- valor de `tipo_pagamento` quando cada um tiver uma tela que o use — um
-- enum com seis valores e um só implementado seria promessa sem a outra
-- ponta construída, a mesma armadilha que o AGENTS.md já registra duas
-- vezes.
-- ============================================================================

begin;

create type tipo_pagamento as enum ('prestador_mensalidade');

create type status_pagamento as enum
  ('pendente', 'aprovado', 'rejeitado', 'cancelado', 'estornado');

create table if not exists pagamentos (
  id               uuid primary key default gen_random_uuid(),
  usuario_id       uuid not null references usuarios(id) on delete cascade,
  tipo             tipo_pagamento not null,
  valor_centavos   int not null check (valor_centavos > 0),
  status           status_pagamento not null default 'pendente',
  mp_preference_id text,
  mp_payment_id    text,
  metadata         jsonb not null default '{}',
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now()
);

create index if not exists pagamentos_usuario_idx
  on pagamentos (usuario_id, criado_em desc);

create unique index if not exists pagamentos_mp_payment_idx
  on pagamentos (mp_payment_id) where mp_payment_id is not null;

create trigger pagamentos_atualizado_em
  before update on pagamentos
  for each row execute function tocar_atualizado_em();

alter table pagamentos enable row level security;

-- Mensalidade do prestador — quando expira, o perfil sai da vitrine.
alter table perfis_prestador
  add column if not exists mensalidade_valida_ate timestamptz;

-- Carência: quem já é prestador verificado ganha 30 dias a partir de agora,
-- em vez de sumir da vitrine no dia do deploy.
update perfis_prestador pp
set mensalidade_valida_ate = now() + interval '30 days'
from usuarios u
where u.id = pp.usuario_id
  and u.doc_verificado = true
  and pp.mensalidade_valida_ate is null;

-- Exposto na view, ao final do select (`create or replace view` não aceita
-- mudar a ordem das colunas existentes) para `getProviders` poder filtrar
-- direto na consulta, do mesmo jeito que `expires_at` já filtra vaga
-- expirada em job_listings.
create or replace view provider_listings
with (security_invoker = false) as
select
  pp.usuario_id                          as profile_id,
  pp.categoria_id                        as category_id,
  pp.descricao                           as description,
  pp.preco_inicial                       as starting_price,
  pp.anos_experiencia                    as years_experience,
  pp.bairros_atendidos                   as service_area,
  pp.fotos_urls                          as photo_urls,
  pp.nota_media                          as avg_rating,
  pp.total_avaliacoes                    as review_count,
  pp.instagram                           as instagram,
  pp.facebook                            as facebook,
  u.nome_completo                        as full_name,
  u.telefone                             as phone,
  u.cidade                               as city,
  u.bairro                               as neighborhood,
  u.avatar_url                           as avatar_url,
  u.telefone_verificado                  as phone_verified,
  u.doc_verificado                       as doc_verified,
  c.slug                                 as category_slug,
  jsonb_build_object('id', c.id, 'slug', c.slug, 'name', c.nome) as category,
  pp.mensalidade_valida_ate              as subscription_valid_until
from perfis_prestador pp
join usuarios u on u.id = pp.usuario_id
join categorias_servico c on c.id = pp.categoria_id
where u.papel = 'prestador_servico';

grant select on provider_listings to anon, authenticated;

commit;

-- ─── Conferência ────────────────────────────────────────────────────────
select
  exists (select 1 from information_schema.tables
    where table_name = 'pagamentos') as tabela_existe,
  exists (select 1 from information_schema.columns
    where table_name = 'perfis_prestador'
      and column_name = 'mensalidade_valida_ate') as coluna_existe,
  exists (select 1 from information_schema.columns
    where table_name = 'provider_listings'
      and column_name = 'subscription_valid_until') as view_expoe_prazo,
  -- `anon`/`authenticated` não podem ler pagamentos.
  not exists (select 1 from information_schema.table_privileges
    where table_name = 'pagamentos'
      and grantee in ('anon', 'authenticated')
      and privilege_type = 'SELECT') as pagamentos_fechado_para_anon;
