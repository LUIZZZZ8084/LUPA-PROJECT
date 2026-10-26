-- ============================================================================
-- Índice para o dono do perfil denunciado (#235)
--
-- `denuncias.prestador_id` é chave estrangeira para `usuarios`, com
-- `on delete cascade`, e nasceu sem índice na #452. Sem ele, excluir
-- qualquer conta varre a tabela de denúncias inteira atrás das linhas
-- filhas. O teste que pergunta ao banco por chave estrangeira sem índice
-- (`schema.test.ts`) pegou.
--
-- Só cria um índice: nenhum dado é tocado. Antes ou depois do deploy,
-- tanto faz, e rodar de novo não muda nada.
-- ============================================================================

create index if not exists denuncias_prestador_idx on denuncias (prestador_id);

-- ─── Conferência: tem de voltar 1 ──────────────────────────────────────
select count(*) as indice_criado
  from pg_indexes
 where schemaname = 'public'
   and indexname = 'denuncias_prestador_idx';
