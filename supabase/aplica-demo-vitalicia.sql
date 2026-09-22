-- ============================================================================
-- O conteúdo de demonstração não vence (#245)
--
-- Decisão do Luiz em 22/09/2026: as vagas e os prestadores hoje visíveis são
-- o que ele usa para demonstrar a Lupa a clientes em Sinop, e não podem
-- sumir. Eram 16 linhas — 7 vagas e 9 prestadores — e todas venciam no
-- **mesmo dia**, 08/10/2026: o default da coluna avaliado uma vez pela
-- `aplica-prazo-vaga.sql`, mais a carência de 30 dias que existia antes da
-- assinatura recorrente. Sem isto, /vagas e /servicos iam a zero de uma vez.
--
-- A sentinela é 2099: data obviamente artificial, que qualquer um reconhece
-- como "posto à mão" e acha por busca. Nulo não serve — `null > now()` é
-- nulo, e é `> now()` que `getJobs` e `getProviders` filtram; a linha sairia
-- da busca em vez de ficar nela para sempre.
--
-- ## Por que o filtro é a data, e não uma marcação de "é demonstração"
--
-- Uma coluna `demonstracao boolean` exigiria que `getJobs` e `getProviders`
-- a conhecessem — regra de demonstração dentro do caminho que serve gente
-- de verdade, que é exatamente o que `src/lib/mock-data.ts` já não pode
-- fazer (o dependency-cruiser reprova). Aqui não entra código nenhum: o
-- filtro continua sendo o mesmo de sempre, e o que muda é o dado.
--
-- ## O alcance é largo de propósito, e por isso é de uma vez só
--
-- Os dois `update` pegam **tudo o que está visível agora**, sem nomear
-- ninguém — o que evita cravar id ou e-mail de conta real num arquivo
-- versionado. Isso só é seguro porque, em 22/09/2026, as 16 linhas eram
-- todas conteúdo de demonstração: 12 do seed, 2 vagas do Luiz e os perfis de
-- prestador dele e do Paulinho.
--
-- **Não rode isto de novo.** No dia em que houver cliente pagante, este
-- arquivo daria vitrine vitalícia a quem parou de pagar.
--
-- ## O que se aceita junto, de olhos abertos
--
-- O perfil do Paulinho deixa de depender da assinatura: se a cobrança
-- recorrente falhar, ele continua na busca e nada avisa. Decisão consciente
-- do Luiz nesta data — a conta é tratada como demonstração, não como
-- cliente. Se um dia virar cliente de verdade, esta é a linha a desfazer
-- primeiro.
--
-- O `seed.sql` grava as mesmas datas, para que um banco novo nasça com a
-- demonstração no ar. Ele não reproduzia isso: `mensalidade_valida_ate`
-- nascia nula e os nove prestadores de exemplo não apareciam na vitrine.
-- ============================================================================

begin;

update vagas
   set expira_em = '2099-12-31'
 where status = 'aberta'
   and expira_em > now();

update perfis_prestador
   set mensalidade_valida_ate = '2099-12-31'
 where mensalidade_valida_ate > now();

commit;

-- ─── Conferência ────────────────────────────────────────────────────────
--
-- Espera-se 5 vagas e 9 prestadores em 2099 (as 2 vagas do Luiz entram na
-- primeira contagem, somando 7).
--
--   select count(*) from vagas
--    where status = 'aberta' and expira_em > now() + interval '10 years';
--
--   select count(*) from perfis_prestador
--    where mensalidade_valida_ate > now() + interval '10 years';
--
-- E nada deve vencer em 08/10/2026:
--
--   select count(*) from vagas where expira_em::date = '2026-10-08';
