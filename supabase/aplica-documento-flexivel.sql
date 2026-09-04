-- =============================================================================
-- LUPA — Prestador com CNPJ opcional, empresa com CPF opcional
--
-- Rode UMA VEZ no banco de produção, no SQL Editor do Supabase. Banco novo
-- não precisa: o `schema.sql` já traz tudo isto.
--
-- PARA QUE SERVE
-- ──────────────
-- Decisão do Luiz em 03/09/2026 (#138): nem todo prestador é só pessoa
-- física — alguns são MEI e têm CNPJ também. E nem todo contratante é
-- empresa registrada — produtor rural e autônomo contratam ajudante sem
-- ter aberto CNPJ (decisão já registrada na #129).
--
--   • `perfis_prestador` ganha `cnpj` (opcional) e `cnpj_verificado`. O
--     CPF em `usuarios` continua sendo a verificação de base de todo
--     prestador; isto é selo adicional — "MEI confirmado" —, nunca
--     substituto.
--   • `perfis_empresa.cnpj` deixa de ser `not null`. Quem escolhe CPF em
--     vez de CNPJ tem o documento gravado em `usuarios`, nunca aqui.
--
-- POR QUE CNPJ PODE FICAR NUMA TABELA QUE `anon` LÊ, E CPF NUNCA
-- ────────────────────────────────────────────────────────────────
-- As duas tabelas têm `for select using (true)` e `grant select` para a
-- chave anônima, que vai para o navegador. CNPJ pode estar ali porque é
-- registro público — a Receita já expõe de graça. CPF não é: por isso
-- ele mora só em `usuarios`, que nenhuma chave anônima alcança, e o
-- teste de schema recusa a coluna `cpf` em qualquer tabela ou view que
-- `anon` leia.
--
-- Aditivo e repetível.
-- =============================================================================

begin;

alter table perfis_prestador
  add column if not exists cnpj text,
  add column if not exists cnpj_verificado boolean not null default false;

create unique index if not exists perfis_prestador_cnpj_idx
  on perfis_prestador (cnpj) where cnpj is not null;

-- `cnpj` era `not null unique`. O índice normal vira parcial, e a
-- constraint antiga sai — sem ela, a coluna aceita nulo.
alter table perfis_empresa
  alter column cnpj drop not null;

alter table perfis_empresa
  drop constraint if exists perfis_empresa_cnpj_key;

create unique index if not exists perfis_empresa_cnpj_idx
  on perfis_empresa (cnpj) where cnpj is not null;

commit;

-- ─── Conferência ────────────────────────────────────────────────────────
-- Os cinco devem vir true. `anon_nao_le_cpf_em_prestador` e
-- `anon_nao_le_cpf_em_empresa` são os que importam mais: se vierem false,
-- alguém pôs CPF numa tabela que a chave do navegador alcança.

select
  exists (
    select 1 from information_schema.columns
     where table_name = 'perfis_prestador' and column_name = 'cnpj'
  ) as prestador_tem_cnpj,
  exists (
    select 1 from information_schema.columns
     where table_name = 'perfis_prestador' and column_name = 'cnpj_verificado'
  ) as prestador_tem_cnpj_verificado,
  not exists (
    select 1 from information_schema.columns
     where table_name = 'perfis_prestador' and column_name = 'cpf'
  ) as anon_nao_le_cpf_em_prestador,
  not exists (
    select 1 from information_schema.columns
     where table_name = 'perfis_empresa' and column_name = 'cpf'
  ) as anon_nao_le_cpf_em_empresa,
  not exists (
    select 1 from information_schema.columns
     where table_name = 'perfis_empresa' and column_name = 'cnpj'
       and is_nullable = 'NO'
  ) as empresa_cnpj_opcional;
