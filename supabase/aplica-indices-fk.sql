-- Índices para as três chaves estrangeiras que não tinham (#210).
--
-- Postgres indexa a chave primária sozinho; a estrangeira, não. Sem
-- índice cobrindo, mexer na tabela **pai** varre a filha inteira para
-- conferir a referência.
--
-- Nenhuma das três é urgente hoje — são dezenas de linhas, e o plano nem
-- usaria o índice. O argumento é o custo da criação: instantânea agora,
-- travando escrita depois que a tabela crescer. `pagamentos` é a que
-- cresce por uso.
--
-- Idempotente: pode rodar de novo sem quebrar.

create index if not exists avaliacoes_avaliador_idx
  on avaliacoes (avaliador_id);

create index if not exists pagamentos_assinatura_idx
  on pagamentos (assinatura_id);

create index if not exists pedidos_verificacao_usuario_idx
  on pedidos_verificacao (usuario_id);
