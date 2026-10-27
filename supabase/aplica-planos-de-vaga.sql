-- ============================================================================
-- Planos de vaga por quantas vagas ficam no ar, e a primeira vaga grátis (#489)
--
-- Troca os pacotes de 5 e 10 vagas (compra única, créditos que não expiram)
-- por planos mensais: Plano 5 (até 5 vagas no ar ao mesmo tempo), Plano 10
-- (até 10) e o ilimitado, que continua sendo `empresa_mensal`. A vaga avulsa
-- segue como compra única. Os preços moram em `PRECO_CENTAVOS`
-- (`src/server/pagamentos/planos.ts`), nunca aqui.
--
-- O que muda no banco:
--   * dois valores novos em `tipo_pagamento`: `empresa_plano_5` e
--     `empresa_plano_10`. Os `empresa_pacote_*` ficam no enum — o Postgres não
--     tira valor de enum, e quem comprou um pacote antes mantém o histórico;
--   * `carteiras_vaga.plano_vagas_no_ar`: o limite do plano que está valendo;
--   * `carteiras_vaga.primeira_vaga_gratis_usada_em`: a primeira vaga grátis
--     é uma por conta;
--   * `estender_mensalidade_vaga` ganha o limite como terceiro argumento;
--   * `reivindicar_primeira_vaga_gratis` e `pessoas_com_aviso_na_cidade`;
--   * `metricas_funil` e `metricas_caixa` passam a reconhecer os tipos novos.
--
-- **Rode antes do deploy**: o código novo chama as funções com o argumento
-- novo e lê as colunas novas, e sem elas publicar vaga e assinar plano
-- falham. Idempotente: seguro de rodar mais de uma vez.
--
-- O enum fica fora da transação de propósito: em Postgres um valor recém-
-- acrescentado não pode ser *usado* na mesma transação em que nasceu. As
-- views abaixo comparam `tipo::text` por isso mesmo.
-- ============================================================================

do $$
begin
  if not exists (
    select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
    where t.typname = 'tipo_pagamento' and e.enumlabel = 'empresa_plano_5'
  ) then
    alter type tipo_pagamento add value 'empresa_plano_5';
  end if;

  if not exists (
    select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
    where t.typname = 'tipo_pagamento' and e.enumlabel = 'empresa_plano_10'
  ) then
    alter type tipo_pagamento add value 'empresa_plano_10';
  end if;
end
$$;

begin;

alter table carteiras_vaga
  add column if not exists plano_vagas_no_ar int
    check (plano_vagas_no_ar is null or plano_vagas_no_ar > 0),
  add column if not exists primeira_vaga_gratis_usada_em timestamptz;

-- Quem já tinha o mensal ilimitado continua ilimitado: `plano_vagas_no_ar`
-- nulo é exatamente isso, e nenhuma linha antiga precisa ser tocada.

-- A versão de dois argumentos sai: com a nova, que tem o terceiro por padrão,
-- a chamada `estender_mensalidade_vaga(usuario, dias)` ficaria ambígua.
drop function if exists estender_mensalidade_vaga(uuid, int);

-- Estende o plano mensal a partir do maior entre agora e o que ja valia, e
-- grava o limite de vagas no ar do plano que acabou de ser pago (#489).
-- `p_dias` nulo revoga: e o caminho do estorno e do chargeback, e leva o
-- limite junto. `p_limite` nulo e o ilimitado.
--
-- Quem troca de plano passa a ter o limite do novo na hora, e a validade
-- soma: os dias pagos do plano antigo nao se perdem. Foi uma escolha
-- consciente — trocar de plano exige cancelar a renovacao do atual, entao
-- nao ha cobranca em duplicidade, e o custo de somar e so alguns dias de
-- um limite diferente.
create or replace function estender_mensalidade_vaga(
  p_usuario uuid,
  p_dias int,
  p_limite int default null
)
returns setof carteiras_vaga language sql
set search_path = public, pg_temp
as $$
  insert into carteiras_vaga (
    usuario_id, mensalidade_valida_ate, plano_vagas_no_ar
  )
  values (
    p_usuario,
    case when p_dias is null then null
         else now() + make_interval(days => p_dias) end,
    case when p_dias is null then null else p_limite end
  )
  on conflict (usuario_id) do update
    set mensalidade_valida_ate = case
      when p_dias is null then null
      else greatest(
        now(),
        coalesce(carteiras_vaga.mensalidade_valida_ate, now())
      ) + make_interval(days => p_dias)
    end,
    plano_vagas_no_ar = case when p_dias is null then null else p_limite end
  returning *;
$$;

-- Usa a primeira vaga gratis, e so se ainda nao foi usada (#489). Devolve
-- verdadeiro quando esta chamada foi quem a usou. A decisao e a gravacao
-- sao a mesma instrucao: dois cliques simultaneos nao ganham duas vagas.
create or replace function reivindicar_primeira_vaga_gratis(p_usuario uuid)
returns boolean language sql
set search_path = public, pg_temp
as $$
  with usada as (
    insert into carteiras_vaga (usuario_id, primeira_vaga_gratis_usada_em)
    values (p_usuario, now())
    on conflict (usuario_id) do update
      set primeira_vaga_gratis_usada_em = now()
      where carteiras_vaga.primeira_vaga_gratis_usada_em is null
    returning 1
  )
  select exists (select 1 from usada);
$$;

-- Quantas pessoas da cidade pediram aviso de vaga e tem um aparelho que o
-- recebe (#489). So o numero sai daqui, nunca quem sao: numa cidade pequena
-- isso diria quem esta procurando sair do emprego atual. Quem decide mostrar
-- ou nao o numero e a aplicacao, abaixo de um minimo.
create or replace function pessoas_com_aviso_na_cidade(p_cidade text)
returns int language sql stable
set search_path = public, pg_temp
as $$
  select count(*)::int
  from preferencias_notificacao p
  where p.cidade = p_cidade
    and exists (
      select 1 from inscricoes_push i where i.usuario_id = p.usuario_id
    );
$$;

create or replace view metricas_funil
with (security_invoker = false) as
with contas as (
  select id, papel, doc_verificado from usuarios
  where papel <> 'admin' and senha_hash <> '!conta-excluida'
)
select
  (select count(*) from contas where papel = 'candidato_clt')
    as candidatos,
  (select count(*) from contas c
     join perfis_candidato pc on pc.usuario_id = c.id
    where c.papel = 'candidato_clt' and pc.visivel_para_empresas)
    as candidatos_visiveis,
  (select count(distinct ca.candidato_id) from candidaturas ca
     join contas c on c.id = ca.candidato_id
    where c.papel = 'candidato_clt')
    as candidatos_que_se_candidataram,
  (select count(*) from contas where papel = 'prestador_servico')
    as prestadores,
  (select count(*) from contas c
     join perfis_prestador pp on pp.usuario_id = c.id
    where c.papel = 'prestador_servico' and c.doc_verificado
      and pp.mensalidade_valida_ate > now())
    as prestadores_na_vitrine,
  (select count(distinct a.usuario_id) from assinaturas a
     join contas c on c.id = a.usuario_id
    where a.tipo = 'prestador_mensalidade' and a.status = 'ativa')
    as prestadores_assinantes,
  (select count(*) from contas where papel = 'empresa')
    as empresas,
  (select count(*) from contas where papel = 'empresa' and doc_verificado)
    as empresas_verificadas,
  (select count(distinct v.empresa_id) from vagas v
     join contas c on c.id = v.empresa_id
    where c.papel = 'empresa')
    as empresas_com_vaga,
  (select count(distinct p.usuario_id) from pagamentos p
     join contas c on c.id = p.usuario_id
    where c.papel = 'empresa' and p.status = 'aprovado'
      and p.tipo::text in ('empresa_vaga_avulsa', 'empresa_pacote_5',
                           'empresa_pacote_10', 'empresa_plano_5',
                           'empresa_plano_10', 'empresa_mensal'))
    as empresas_que_compraram,
  (select count(*) from assinaturas where status = 'ativa')
    as assinaturas_ativas,
  (select coalesce(sum(valor_centavos), 0) from assinaturas
    where status = 'ativa')
    as recorrente_ativo_centavos,
  (select coalesce(sum(valor_centavos), 0) from pagamentos
    where status = 'aprovado' and criado_em > now() - interval '30 days')
    as entrou_30_dias_centavos;


create or replace view metricas_caixa
with (security_invoker = false) as
select
  coalesce(sum(valor_centavos) filter (where status = 'aprovado'), 0)
    as entrou_centavos,
  coalesce(sum(valor_centavos) filter (where status = 'estornado'), 0)
    as estornado_centavos,
  coalesce(sum(valor_centavos) filter (where status = 'contestado'), 0)
    as contestado_centavos,
  coalesce(sum(valor_centavos) filter (
    where status = 'aprovado'
      and tipo::text in ('prestador_mensalidade', 'empresa_plano_5',
                         'empresa_plano_10', 'empresa_mensal')
  ), 0) as recorrente_centavos,
  count(*) filter (where status = 'aprovado')    as cobrancas,
  count(*) filter (where status = 'contestado')  as contestacoes
from pagamentos;


commit;

-- Funções só pela chave de serviço (#449): o `revoke ... on all functions`
-- só alcança as que já existem, então roda de novo depois de criar função.
revoke execute on all functions in schema public
  from public, anon, authenticated;
grant execute on all functions in schema public to service_role;

alter default privileges in schema public
  revoke execute on functions from anon, authenticated;
