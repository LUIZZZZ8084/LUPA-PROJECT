-- =============================================================================
-- LUPA — CPF de quem oferece serviço
--
-- Rode UMA VEZ no banco de produção, no SQL Editor do Supabase. Banco novo
-- não precisa: o `schema.sql` já traz tudo isto.
--
-- PARA QUE SERVE
-- ──────────────
-- Ativar o lado prestador de uma conta passa a exigir CPF. É o que amarra o
-- anúncio a uma pessoa real — numa plataforma onde alguém abre a porta de
-- casa para um desconhecido, perfil sem identidade é o começo do golpe.
--
-- POR QUE EM `usuarios` E NÃO EM `perfis_prestador`
-- ─────────────────────────────────────────────────
-- Parece que o lugar simétrico seria `perfis_prestador`, ao lado do CNPJ em
-- `perfis_empresa`. Não é, e a diferença é de privacidade, não de arrumação:
--
--   • `perfis_prestador` tem policy `for select using (true)` e
--     `grant select ... to anon` — a chave anônima vai para o navegador.
--     Documento ali seria documento publicado.
--   • `usuarios` não tem grant nenhum para `anon`: só a chave de serviço a
--     alcança, no servidor. É onde já mora o hash de senha.
--
-- E CNPJ pode ser público porque é registro público. CPF não é.
--
-- Coluna opcional de propósito: conta criada antes deste campo existir
-- continua funcionando sem migração de dado, e a esmagadora maioria das
-- contas nunca vai ter CPF, porque não é prestador. É a tela de ativação
-- que exige preenchido — mesmo raciocínio de `aplica-endereco-vaga.sql`.
--
-- O ÍNDICE É PARCIAL, E ISSO IMPORTA
-- ──────────────────────────────────
-- `unique` puro trataria as contas sem documento — quase todas — como
-- colisão em alguns bancos. O `where cpf is not null` mantém a garantia
-- onde ela vale (um CPF, um prestador) e ignora o resto.
--
-- Aditivo e repetível. Não recria view nenhuma: o CPF não entra em
-- `provider_listings` nem em lugar algum que `anon` leia.
-- =============================================================================

begin;

alter table usuarios
  add column if not exists cpf text;

create unique index if not exists usuarios_cpf_idx
  on usuarios (cpf)
  where cpf is not null;

commit;

-- ─── Conferência ────────────────────────────────────────────────────────
-- Os quatro devem vir true. `anon_nao_le_usuarios` é o que importa mais:
-- se vier false, o documento está ao alcance da chave do navegador.

select
  exists (
    select 1 from information_schema.columns
     where table_name = 'usuarios' and column_name = 'cpf'
  ) as coluna_existe,
  exists (
    select 1 from pg_indexes
     where tablename = 'usuarios' and indexname = 'usuarios_cpf_idx'
  ) as indice_existe,
  not has_table_privilege('anon', 'usuarios', 'SELECT')
    as anon_nao_le_usuarios,
  not exists (
    select 1 from information_schema.columns
     where table_name = 'provider_listings' and column_name = 'cpf'
  ) as cpf_fora_da_vitrine;
