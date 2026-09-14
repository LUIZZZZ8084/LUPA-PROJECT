-- ============================================================================
-- Trocar a senha derruba as sessoes antigas (#225)
--
-- A sessao e um JWT de 7 dias e nao mora no banco: o app roda em funcoes
-- serverless, onde nao ha processo de longa duracao, e cada consulta a mais
-- e latencia para quem esta em 3G em Sinop. A decisao continua certa.
--
-- O preco registrado era nao conseguir revogar antes de expirar — e o caso
-- que doi e exatamente o mais importante: quem troca a senha **porque
-- desconfia de acesso indevido** continuava com o invasor dentro por ate
-- uma semana. A tela de troca dizia isso com todas as letras, o que e
-- honesto e nao resolve nada para quem esta sendo invadido agora.
--
-- Esta coluna e o corte. Todo token emitido antes dela deixa de valer.
--
-- **Nao e sessao no banco, e a diferenca e o custo.** Sessao no banco seria
-- uma consulta por requisicao. Aqui a aplicacao le uma lista curta — so
-- quem trocou a senha nos ultimos 7 dias — e a mantem em cache por 60
-- segundos. Token mais velho que 7 dias ja expirou sozinho, entao a lista
-- nao cresce com o tempo: ela cresce com quantas trocas de senha
-- aconteceram nesta semana, que e um numero pequeno.
--
-- O preco novo, aceito: uma sessao revogada pode sobreviver ate 60
-- segundos. Contra sete dias, e o que se queria.
--
-- Nulo e o normal: quem nunca trocou a senha nao tem corte.
--
-- Idempotente: `add column if not exists`.
-- ============================================================================

alter table usuarios
  add column if not exists sessoes_validas_desde timestamptz;

-- O indice cobre a unica consulta que le a coluna: "quem revogou nos
-- ultimos 7 dias". Parcial porque a esmagadora maioria das linhas e nula —
-- indice cheio aqui seria pagar escrita por uma leitura que nunca olha
-- para elas.
create index if not exists usuarios_sessoes_validas_desde_idx
  on usuarios (sessoes_validas_desde)
  where sessoes_validas_desde is not null;
