-- ============================================================================
-- Cobrança de vaga para quem contrata (#172)
--
-- Publicar vaga era de graça e sem limite. `perfis_empresa.plano` existia
-- no schema desde o começo (`trial`/`mensal`) e nada no código o lia —
-- estado declarado sem produtor, a mesma armadilha que o `AGENTS.md` já
-- registra em `pedidos_verificacao` e nos valores de `status_pagamento`.
--
-- Quatro formas de pagar, decididas pelo Luiz em 09/09/2026: vaga avulsa
-- (R$ 29,90), pacote de 5 (R$ 119,90), pacote de 10 (R$ 149,90) e mensal
-- ilimitado (R$ 199,90). Os três primeiros viram crédito e não expiram; o
-- último é assinatura recorrente e não consome crédito nenhum.
--
-- Os valores em si não moram aqui: a fonte única é `PRECO_CENTAVOS`, em
-- `src/server/pagamentos/planos.ts`. Esta lista existe só para quem lê a
-- migração entender o que os valores do enum significam — se ela e o
-- `planos.ts` divergirem um dia, quem manda é o `planos.ts`.
--
-- Idempotente: roda de novo sem erro num banco que já tem tudo isto.
-- ============================================================================

-- Os valores novos do enum ficam fora da transação de propósito: em
-- Postgres um valor recém-acrescentado não pode ser *usado* na mesma
-- transação em que nasceu, e deixar os dois juntos é o tipo de detalhe
-- que só aparece quando alguém edita este arquivo meses depois.
do $$
begin
  if not exists (
    select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
    where t.typname = 'tipo_pagamento' and e.enumlabel = 'empresa_vaga_avulsa'
  ) then
    alter type tipo_pagamento add value 'empresa_vaga_avulsa';
  end if;

  if not exists (
    select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
    where t.typname = 'tipo_pagamento' and e.enumlabel = 'empresa_pacote_5'
  ) then
    alter type tipo_pagamento add value 'empresa_pacote_5';
  end if;

  if not exists (
    select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
    where t.typname = 'tipo_pagamento' and e.enumlabel = 'empresa_pacote_10'
  ) then
    alter type tipo_pagamento add value 'empresa_pacote_10';
  end if;

  if not exists (
    select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
    where t.typname = 'tipo_pagamento' and e.enumlabel = 'empresa_mensal'
  ) then
    alter type tipo_pagamento add value 'empresa_mensal';
  end if;
end
$$;

begin;

/*
 * Tabela própria, e não colunas em `perfis_empresa`: aquela é lida pela
 * chave anônima, e quantos créditos uma empresa tem é dado comercial
 * dela — não registro público como o CNPJ. Mesmo raciocínio que mantém o
 * CPF em `usuarios`.
 *
 * A chave é `usuario_id` porque desde a #129 quem publica vaga também
 * pode ser prestador contratando ajudante, e ele não tem perfil de
 * empresa quando compra o primeiro crédito.
 */
create table if not exists carteiras_vaga (
  usuario_id             uuid primary key references usuarios(id) on delete cascade,
  creditos_vaga          int not null default 0 check (creditos_vaga >= 0),
  mensalidade_valida_ate timestamptz,
  criado_em              timestamptz not null default now(),
  atualizado_em          timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'carteiras_vaga_atualizado_em'
  ) then
    create trigger carteiras_vaga_atualizado_em
      before update on carteiras_vaga
      for each row execute function tocar_atualizado_em();
  end if;
end
$$;

alter table carteiras_vaga enable row level security;

revoke select on carteiras_vaga from anon, authenticated;

/*
 * A preferência do Checkout Pro volta.
 *
 * A #170 tinha derrubado a coluna junto com o modelo avulso — nada mais a
 * escrevia, e coluna sem produtor é a mesma armadilha do valor de enum
 * sem produtor. A vaga avulsa e os pacotes a trazem de volta, agora com
 * a tela que a usa.
 */
alter table pagamentos add column if not exists mp_preference_id text;

/*
 * As tres operacoes da carteira vivem no banco, e nao na aplicacao, pelo
 * mesmo motivo do contador de tentativas e do limite de publicacoes:
 * "le, decide, grava" perde a corrida. Duas cobrancas aprovadas quase
 * juntas creditariam o mesmo total, e duas publicacoes simultaneas com um
 * credito so passariam as duas.
 */

-- Soma (ou subtrai, com quantidade negativa) creditos, criando a carteira
-- se ainda nao existir. Nunca abaixo de zero: quem ja gastou o que
-- comprou e depois contestou a cobranca para em zero, nao fica devendo.
create or replace function creditar_vaga(p_usuario uuid, p_quantidade int)
returns setof carteiras_vaga language sql as $$
  insert into carteiras_vaga (usuario_id, creditos_vaga)
  values (p_usuario, greatest(0, p_quantidade))
  on conflict (usuario_id) do update
    set creditos_vaga = greatest(0, carteiras_vaga.creditos_vaga + p_quantidade)
  returning *;
$$;

-- Gasta um credito, e so se houver. Zero linhas devolvidas quer dizer
-- "nao tinha" — quem chama le isso como recusa, nao como erro.
create or replace function consumir_credito_vaga(p_usuario uuid)
returns setof carteiras_vaga language sql as $$
  update carteiras_vaga
  set creditos_vaga = creditos_vaga - 1
  where usuario_id = p_usuario and creditos_vaga > 0
  returning *;
$$;

-- Estende o plano mensal a partir do maior entre agora e o que ja valia.
-- `p_dias` nulo revoga: e o caminho do estorno e do chargeback.
create or replace function estender_mensalidade_vaga(
  p_usuario uuid,
  p_dias int
)
returns setof carteiras_vaga language sql as $$
  insert into carteiras_vaga (usuario_id, mensalidade_valida_ate)
  values (
    p_usuario,
    case when p_dias is null then null
         else now() + make_interval(days => p_dias) end
  )
  on conflict (usuario_id) do update
    set mensalidade_valida_ate = case
      when p_dias is null then null
      else greatest(
        now(),
        coalesce(carteiras_vaga.mensalidade_valida_ate, now())
      ) + make_interval(days => p_dias)
    end
  returning *;
$$;


/*
 * Carência para quem já publicava de graça.
 *
 * Toda conta que já tem vaga publicada ganha crédito para reativar o que
 * já está no ar — sem isso, quem publicou ontem descobre no dia do deploy
 * que a vaga dela expira e reativar passou a custar. É a mesma lógica de
 * não tirar ninguém do ar no dia da mudança que já valeu para o prazo de
 * vaga e para a mensalidade de prestador.
 */
insert into carteiras_vaga (usuario_id, creditos_vaga)
select v.empresa_id, count(*)
from vagas v
where v.status = 'aberta'
group by v.empresa_id
on conflict (usuario_id) do nothing;

commit;

-- ─── Conferência ────────────────────────────────────────────────────────
select
  exists (select 1 from information_schema.tables
    where table_name = 'carteiras_vaga') as tabela_existe,
  (select count(*) from pg_enum e join pg_type t on t.oid = e.enumtypid
    where t.typname = 'tipo_pagamento') as valores_de_tipo_pagamento,
  (select coalesce(sum(creditos_vaga), 0) from carteiras_vaga) as creditos_de_carencia,
  not exists (select 1 from information_schema.table_privileges
    where table_name = 'carteiras_vaga'
      and grantee in ('anon', 'authenticated')
      and privilege_type = 'SELECT') as carteira_fechada_para_anon;
