-- ============================================================================
-- Parceiros autorizados por e-mail (#505)
--
-- O admin autoriza o e-mail de quem vai usar a Lupa de graça por acordo, com
-- prazo ou sem. O benefício chega à conta com aquele e-mail quando ela
-- confirma o endereço, e mora nas colunas que o pagamento já usa.
--
-- **Rode antes do deploy**: o código novo lê esta tabela ao confirmar
-- e-mail e na tela /admin/parceiros. Seguro de rodar mais de uma vez.
-- ============================================================================

begin;

create table if not exists parceiros (
  id            uuid primary key default gen_random_uuid(),
  -- Minúsculas, como `usuarios.email`, para a comparação ser de igual.
  email         text not null check (email = lower(btrim(email)) and email like '%_@_%'),
  nome          text not null check (char_length(btrim(nome)) between 2 and 80),
  -- Até quando vale; nulo é sem prazo.
  valido_ate    timestamptz,
  criado_em     timestamptz not null default now(),
  criado_por    uuid references usuarios(id) on delete set null,
  -- Encerrar guarda o registro: quem teve parceria, e até quando.
  encerrado_em  timestamptz,
  -- A conta que recebeu o benefício, e a validade gravada nela. Encerrar
  -- compara com esta data: o que a conta pagou além dela fica.
  usuario_id    uuid references usuarios(id) on delete set null,
  concedido_em  timestamptz,
  concedido_ate timestamptz
);

-- Uma parceria aberta por e-mail: duas dariam dois prazos para a mesma conta.
create unique index if not exists parceiros_um_aberto_por_email
  on parceiros (email) where encerrado_em is null;

-- Toda chave estrangeira tem índice: excluir uma conta procura por elas.
create index if not exists parceiros_usuario_idx on parceiros (usuario_id);
create index if not exists parceiros_criado_por_idx on parceiros (criado_por);

alter table parceiros enable row level security;

-- Dado da empresa: nenhuma das chaves públicas lê nem escreve. É `revoke
-- all` porque o Supabase concede tudo às duas chaves em toda tabela nova
-- (#421), e o revoke geral do fim do `schema.sql` não roda aqui.
revoke all on parceiros from anon, authenticated;

commit;
