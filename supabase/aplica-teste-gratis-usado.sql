-- ============================================================================
-- Teste gratis: um por conta (#392)
--
-- O teste de 15 dias da mensalidade de prestador era concedido a cada
-- assinatura nova que ficava ativa. Cancelar e terminal, entao assinar de
-- novo criava outra assinatura e outra concessao, e nada registrava que a
-- pessoa ja tinha usado o dela: quem repetisse o ciclo a cada 15 dias
-- ficava na vitrine sem nunca pagar.
--
-- Esta coluna e o registro. Fica em `usuarios`, e nao em `perfis_prestador`,
-- porque aquela tabela e lida pela chave anonima e esta e informacao de
-- cobranca. Nulo e o normal: quem ainda nao usou o teste.
--
-- **Sem preenchimento retroativo, de proposito.** Quem ja tinha mensalidade
-- antes desta mudanca recebeu acesso por outro caminho (a carencia sem
-- cartao, que ja acabou), nao pelo teste. Marcar essas contas como "ja
-- usou" cobraria na hora de quem nunca viu a regra. Cada conta existente
-- mantem o direito a um teste, e o primeiro uso grava a data.
--
-- RODE ESTE ARQUIVO ANTES DO DEPLOY. O codigo novo le a coluna ao assinar:
-- sem ela, assinar a mensalidade falha.
--
-- Seguro de rodar mais de uma vez.
-- ============================================================================

alter table usuarios
  add column if not exists teste_gratis_usado_em timestamptz;
