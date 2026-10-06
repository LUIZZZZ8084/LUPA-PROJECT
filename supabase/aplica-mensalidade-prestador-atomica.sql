-- ============================================================================
-- Mensalidade de prestador estendida no SQL, não em JS (#348)
--
-- `estenderMensalidade`, em `src/server/prestadores/servico.ts`, calculava a
-- nova validade com um ler-modificar-gravar na aplicação: lia
-- `mensalidade_valida_ate`, computava `max(agora, atual) + dias` em
-- JavaScript e gravava. Duas extensões concorrentes para o mesmo prestador
-- leriam a mesma base e uma se perderia — perda de escrita silenciosa na
-- validade de quem pagou.
--
-- Na prática a corrida não acontecia, porque a máquina de estado do
-- pagamento serializa as chamadas (o índice único de `mp_payment_id` faz
-- cada cobrança virar no máximo uma extensão, e renovações são mensais).
-- Mas depender desse invariante de outro módulo é frágil: esta função põe a
-- conta onde a corrida não pode existir, igual à `estender_mensalidade_vaga`
-- do plano de vaga.
--
-- `p_dias is null` revoga (o estorno tira a mensalidade na hora). Zero
-- linhas devolvidas significa "não tem perfil de prestador", e a aplicação
-- traduz isso no 404 de sempre.
--
-- Idempotente: `create or replace` roda de novo sem erro.
-- ============================================================================

create or replace function estender_mensalidade_prestador(
  p_usuario uuid,
  p_dias int
)
returns setof perfis_prestador language sql
set search_path = public, pg_temp
as $$
  update perfis_prestador
  set mensalidade_valida_ate = case
    when p_dias is null then null
    else greatest(
      now(),
      coalesce(mensalidade_valida_ate, now())
    ) + make_interval(days => p_dias)
  end
  where usuario_id = p_usuario
  returning *;
$$;
