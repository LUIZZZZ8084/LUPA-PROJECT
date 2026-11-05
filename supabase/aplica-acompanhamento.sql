-- ============================================================================
-- Anotações e entrevista marcada na ficha da candidatura (#539)
--
-- Uma tabela nova, só da empresa: a anotação nunca chega a quem se
-- candidatou. Apagada em cascata com a candidatura.
--
-- **Rode antes do deploy**: a ficha nova lê esta tabela, e sem ela a ficha
-- responde indisponível. Seguro de rodar mais de uma vez.
-- ============================================================================

begin;

/*
 * O que a empresa anota sobre uma candidatura, e a entrevista marcada (#539).
 *
 * **Tabela à parte, e não colunas em `candidaturas`**, porque o leitor é
 * outro. A candidatura é da pessoa e da empresa ao mesmo tempo — a pessoa vê
 * o estágio dela em "Minhas candidaturas" —, e a anotação é só da empresa:
 * "boa conversa, pede R$ 2.500" não pode chegar a quem se candidatou por
 * uma view que alguém amplie amanhã. Separada, nenhuma consulta do lado do
 * candidato a alcança sem um `join` escrito de propósito.
 *
 * Uma linha por candidatura, criada quando a empresa salva pela primeira
 * vez, e apagada em cascata com ela: excluir a conta do candidato apaga a
 * candidatura, e a anotação vai junto.
 *
 * `entrevista_em` é **hora de parede, sem fuso** (`timestamp`, não
 * `timestamptz`): "quinta às 14h" é a hora no relógio de quem vai à
 * entrevista, na cidade da vaga. Com fuso, a mesma entrevista apareceria às
 * 13h para quem abrisse o painel em Brasília.
 */
create table if not exists acompanhamento_candidatura (
  candidatura_id   uuid primary key references candidaturas(id) on delete cascade,
  anotacao         text not null default ''
    check (char_length(anotacao) <= 2000),
  entrevista_em    timestamp,
  entrevista_local text
    check (entrevista_local is null or char_length(entrevista_local) <= 200),
  atualizado_em    timestamptz not null default now()
);

alter table acompanhamento_candidatura enable row level security;

revoke select on acompanhamento_candidatura from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger
  on acompanhamento_candidatura from anon, authenticated;

commit;

select
  exists (select 1 from information_schema.tables
    where table_name = 'acompanhamento_candidatura') as tabela_existe,
  (select relrowsecurity from pg_class
    where relname = 'acompanhamento_candidatura') as rls_ligada;
