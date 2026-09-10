-- ============================================================================
-- Gerador de currículo pago (#47)
--
-- Compra única de R$ 14,90 (`curriculo_pdf`, fonte do preço em
-- `PRECO_CENTAVOS`, `src/server/pagamentos/planos.ts`) que libera, para
-- sempre, a geração e o download do currículo em PDF. Não é assinatura:
-- não há data de validade para guardar, só o interruptor —
-- `gerador_curriculo_liberado`.
--
-- O PDF em si não é guardado em lugar nenhum: é montado na hora, a cada
-- download, a partir do que está salvo no perfil naquele momento — o
-- perfil muda depois da compra, e o currículo tem que acompanhar sem
-- custar uma segunda cobrança.
--
-- Idempotente: roda de novo sem erro num banco que já tem tudo isto.
-- ============================================================================

-- Valor novo do enum fora da transação de propósito: em Postgres um valor
-- recém-acrescentado não pode ser *usado* na mesma transação em que
-- nasceu.
do $$
begin
  if not exists (
    select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
    where t.typname = 'tipo_pagamento' and e.enumlabel = 'curriculo_pdf'
  ) then
    alter type tipo_pagamento add value 'curriculo_pdf';
  end if;
end
$$;

begin;

alter table perfis_candidato
  add column if not exists gerador_curriculo_liberado boolean not null default false;

commit;

-- ─── Conferência ────────────────────────────────────────────────────────
select
  exists (select 1 from information_schema.columns
    where table_name = 'perfis_candidato'
      and column_name = 'gerador_curriculo_liberado') as coluna_existe,
  exists (select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
    where t.typname = 'tipo_pagamento' and e.enumlabel = 'curriculo_pdf'
  ) as tipo_de_pagamento_existe;
