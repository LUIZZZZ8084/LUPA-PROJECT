-- =============================================================================
-- LUPA — A razão social que a Receita devolveu, no perfil do prestador
--
-- Rode UMA VEZ no banco de produção, no SQL Editor do Supabase. Banco novo
-- não precisa: o `schema.sql` já traz tudo isto.
--
-- PARA QUE SERVE
-- ──────────────
-- A #138 deu CNPJ opcional ao prestador, mas comparava a razão social da
-- Receita com o **nome da pessoa** — o que só bate para MEI. Um eletricista
-- com "Silva Elétrica e Manutenção Ltda" era reprovado por estar certo.
--
-- A correção (#140) tira a comparação e guarda o que a Receita respondeu.
-- O perfil passa a mostrar o nome da empresa ao lado do número: quem vai
-- contratar lê e julga se aquilo faz sentido para o serviço anunciado. Um
-- CNPJ sozinho na tela não informa nada.
--
-- O QUE ISSO PROVA, E O QUE NÃO PROVA
-- ────────────────────────────────────
-- Prova que existe empresa ativa com aquele CNPJ, e qual é o nome dela.
-- Não prova que é da pessoa — a mesma limitação já registrada para o CNPJ
-- de empresa (#130). Por isso a tela não chama de "verificado".
--
-- Razão social é registro público, como o CNPJ: pode ficar nesta tabela,
-- que a chave anônima lê. CPF é que não pode, e continua fora.
--
-- Aditivo e repetível.
-- =============================================================================

begin;

alter table perfis_prestador
  add column if not exists razao_social text;

commit;

-- ─── Conferência ────────────────────────────────────────────────────────
-- Os dois devem vir true.

select
  exists (
    select 1 from information_schema.columns
     where table_name = 'perfis_prestador' and column_name = 'razao_social'
  ) as coluna_existe,
  not exists (
    select 1 from information_schema.columns
     where table_name = 'perfis_prestador' and column_name = 'cpf'
  ) as anon_nao_le_cpf_em_prestador;
