-- ============================================================================
-- Painel do admin por estado, cidade e papel, e o funil (#471)
--
-- Troca `metricas_por_local`, que agrupava por cidade e bairro (o bairro de
-- pessoa saiu do produto na #321) e não dizia o papel, por três views novas:
-- contas por estado, contas por cidade e o funil de cada papel com a receita
-- que se repete. E corrige `metricas_totais`, que somava a conta excluída
-- (#423) como gente e a vaga vencida como aberta.
--
-- Só view: nenhuma tabela muda, nenhum dado é tocado. As definições são as
-- mesmas do `schema.sql`, e o `schema.test.ts` confere isso aplicando este
-- arquivo por cima do schema e comparando o que o banco guardou.
--
-- **Rode antes do deploy**: o código novo lê as views novas, e sem elas o
-- painel do admin responde "indisponível". Seguro de rodar mais de uma vez.
-- ============================================================================

begin;

create or replace view metricas_totais
with (security_invoker = false) as
with contas as (
  select papel from usuarios
  where papel <> 'admin' and senha_hash <> '!conta-excluida'
)
select
  (select count(*) from contas)                                     as usuarios,
  (select count(*) from contas where papel = 'candidato_clt')       as candidatos,
  (select count(*) from contas where papel = 'prestador_servico')   as prestadores,
  (select count(*) from contas where papel = 'empresa')             as empresas,
  (select count(*) from vagas
     where status = 'aberta' and expira_em > now())                 as vagas_abertas;

create or replace view metricas_contas_por_estado
with (security_invoker = false) as
select
  substring(cidade from ' - ([A-Z]{2})$')              as uf,
  count(*) filter (where papel = 'candidato_clt')      as candidatos,
  count(*) filter (where papel = 'prestador_servico')  as prestadores,
  count(*) filter (where papel = 'empresa')            as empresas,
  count(*)                                             as total
from usuarios
where papel <> 'admin' and senha_hash <> '!conta-excluida'
group by 1;

create or replace view metricas_contas_por_cidade
with (security_invoker = false) as
select
  cidade,
  count(*) filter (where papel = 'candidato_clt')      as candidatos,
  count(*) filter (where papel = 'prestador_servico')  as prestadores,
  count(*) filter (where papel = 'empresa')            as empresas,
  count(*)                                             as total
from usuarios
where papel <> 'admin' and senha_hash <> '!conta-excluida'
group by cidade;

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

drop view if exists metricas_por_local;

-- Métrica administrativa nunca é pública. As views são
-- `security_invoker = false` e leem `usuarios` por cima da RLS: sem o
-- revoke, a chave anônima leria quantas contas há em cada cidade. E é
-- `revoke all`, não só o select: o Supabase concede também escrita às duas
-- chaves em toda view nova (#421), e o revoke geral do fim do `schema.sql`
-- não roda aqui.
revoke all on metricas_totais            from anon, authenticated;
revoke all on metricas_contas_por_estado from anon, authenticated;
revoke all on metricas_contas_por_cidade from anon, authenticated;
revoke all on metricas_funil             from anon, authenticated;

commit;
