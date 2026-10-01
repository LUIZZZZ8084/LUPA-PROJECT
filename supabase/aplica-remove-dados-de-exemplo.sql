-- ============================================================================
-- Tira da vitrine de produção os dados de exemplo do seed (#302)
--
-- O `seed.sql` é para banco local: ele cria 14 contas de exemplo de Sinop
-- (9 prestadores, 3 empresas, 2 candidatos), 5 vagas e o que pende delas.
-- Em produção elas apareciam para visitante real como se fossem ofertas de
-- verdade — e, com a home pública desde a #241, eram a primeira coisa que
-- alguém via.
--
-- **Isto reverte a #245.** Em 22/09/2026 a decisão foi manter esse
-- conteúdo no ar, com vitrine até 2099 (`aplica-demo-vitalicia.sql`), para
-- demonstrar a Lupa a clientes em Sinop. Em 01/10/2026 o pedido passou a
-- ser o contrário: a vitrine mostra só quem existe. Rode quando os dois
-- concordarem — depois disso, demonstração se faz no modo demonstração
-- (`npm run dev:demo`, ou qualquer ambiente sem Supabase), que continua
-- existindo e usa `src/lib/mock-data.ts`, não o banco.
--
-- ## Só os ids do seed, e nada mais
--
-- O seed usa ids fixos, e é por eles que se apaga — nunca por nome, e-mail
-- ou "o que está visível agora". Conta criada por gente de verdade não tem
-- esses ids e não é tocada, mesmo que tenha sido usada para demonstração.
--
-- Apagar a conta leva junto, pelas chaves estrangeiras com `on delete
-- cascade`, o perfil, as vagas da empresa, as candidaturas a essas vagas,
-- as avaliações recebidas, as publicações e os pedidos de verificação.
-- Avaliação que uma conta de exemplo tenha *feito* fica, com o autor nulo
-- (`avaliador_id ... on delete set null`) — o seed não cria nenhuma.
--
-- Repetível: rodar de novo não encontra nada e não quebra.
-- ============================================================================

begin;

delete from vagas
 where id in (
   '44444444-4444-4444-8444-000000000001',
   '44444444-4444-4444-8444-000000000002',
   '44444444-4444-4444-8444-000000000003',
   '44444444-4444-4444-8444-000000000004',
   '44444444-4444-4444-8444-000000000005'
 );

delete from usuarios
 where id in (
   -- prestadores
   '11111111-1111-4111-8111-000000000001',
   '11111111-1111-4111-8111-000000000002',
   '11111111-1111-4111-8111-000000000003',
   '11111111-1111-4111-8111-000000000004',
   '11111111-1111-4111-8111-000000000005',
   '11111111-1111-4111-8111-000000000006',
   '11111111-1111-4111-8111-000000000007',
   '11111111-1111-4111-8111-000000000008',
   '11111111-1111-4111-8111-000000000009',
   -- empresas
   '22222222-2222-4222-8222-000000000001',
   '22222222-2222-4222-8222-000000000002',
   '22222222-2222-4222-8222-000000000003',
   -- candidatos
   '33333333-3333-4333-8333-000000000001',
   '33333333-3333-4333-8333-000000000002'
 );

commit;

-- ─── Conferência: as duas contagens têm de voltar zero ─────────────────
select
  (select count(*) from usuarios
     where id::text like '11111111-1111-4111-8111-%'
        or id::text like '22222222-2222-4222-8222-%'
        or id::text like '33333333-3333-4333-8333-%') as contas_de_exemplo,
  (select count(*) from vagas
     where id::text like '44444444-4444-4444-8444-%') as vagas_de_exemplo;
