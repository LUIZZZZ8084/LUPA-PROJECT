-- =============================================================================
-- LUPA — neutraliza os telefones das contas de exemplo
--
-- Rode UMA VEZ se você executou o `seed.sql` numa versão anterior à correção
-- da Issue #24. Não faz nada em banco que nunca recebeu o seed.
--
-- O seed antigo trazia números fictícios porém plausíveis (66 99911-0001).
-- Com o Supabase ligado, o botão de contato monta `wa.me` com o telefone do
-- perfil — e quem tivesse aquele número em Sinop passaria a receber mensagem
-- de desconhecido procurando eletricista.
--
-- A troca põe a parte de assinante começando em 0, o que não existe no plano
-- de numeração brasileiro: o WhatsApp recusa e ninguém é alcançado. Os dois
-- últimos dígitos são preservados para os perfis continuarem distinguíveis.
--
-- Só toca em contas `@teste.lupa`. Conta de pessoa real fica intocada.
-- =============================================================================

update usuarios
   set telefone = '660000000' || lpad(right(telefone, 2), 2, '0')
 where email like '%@teste.lupa';

-- Confere: o resultado deve ser 0 linhas.
select telefone, nome_completo
  from usuarios
 where email like '%@teste.lupa'
   and telefone ~ '^[0-9]{2}9[0-9]{8}$';
