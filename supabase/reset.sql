-- =============================================================================
-- LUPA — reset do banco
--
-- DESTRUTIVO. Apaga todas as tabelas, views, tipos e funções que o
-- `schema.sql` cria — e, com elas, todos os dados.
--
-- Serve para um caso só: voltar a um banco limpo para rodar `schema.sql`
-- de novo. Tipicamente porque a primeira execução parou no meio, ou porque
-- o arquivo foi rodado duas vezes e o Postgres recusou com
-- `type "papel_usuario" already exists`.
--
-- NÃO rode com usuário de verdade cadastrado. Não há como desfazer.
--
-- Por que isto é um arquivo à parte, e não um `drop if exists` no topo do
-- `schema.sql`: um schema que se auto-limpa apaga um banco de produção
-- inteiro no dia em que alguém rodar o arquivo errado sem ler. Operação
-- destrutiva precisa de nome próprio e de uma decisão consciente.
--
-- O ciclo schema → reset → schema é exercitado por teste automatizado
-- contra um Postgres real (`tests/unit/schema.test.ts`).
-- =============================================================================

-- As views primeiro: dependem das tabelas.
drop view if exists metricas_planos cascade;
drop view if exists metricas_por_local cascade;
drop view if exists metricas_cadastros_por_dia cascade;
drop view if exists metricas_totais cascade;
drop view if exists verification_queue cascade;
drop view if exists candidatos_disponiveis cascade;
drop view if exists candidate_applications cascade;
drop view if exists company_applications cascade;
drop view if exists job_listings cascade;
drop view if exists provider_listings cascade;

-- As tabelas. O `cascade` leva junto índices, constraints e triggers.
drop table if exists visualizacoes_vaga cascade;
drop table if exists pedidos_verificacao cascade;
drop table if exists publicacoes cascade;
drop table if exists avaliacoes cascade;
drop table if exists candidaturas cascade;
drop table if exists vagas cascade;
drop table if exists perfis_empresa cascade;
drop table if exists perfis_prestador cascade;
drop table if exists perfis_candidato cascade;
drop table if exists categorias_servico cascade;
drop table if exists admins cascade;
drop table if exists usuarios cascade;

-- As funções dos triggers. Sobrevivem ao `drop table`, porque a função é
-- do schema e não da tabela — é justamente o tipo de objeto órfão que faz
-- a segunda execução do schema falhar de um jeito difícil de entender.
drop function if exists registrar_visualizacao(uuid) cascade;
drop function if exists conferir_limite_publicacoes() cascade;
drop function if exists atualizar_nota_prestador() cascade;
drop function if exists tocar_atualizado_em() cascade;

-- Os tipos enum por último: as colunas que os usavam já se foram.
drop type if exists status_publicacao cascade;
drop type if exists plano_empresa cascade;
drop type if exists status_candidatura cascade;
drop type if exists status_vaga cascade;
drop type if exists status_verificacao cascade;
drop type if exists papel_usuario cascade;
