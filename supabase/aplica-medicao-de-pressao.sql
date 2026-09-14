-- ============================================================================
-- Pressao nos tetos: medir sem guardar quem (#207)
--
-- O AGENTS.md registra duas decisoes de nao proteger agora — captcha fora
-- de escopo, Cloudflare so "quando aparecer abuso medido". Acontece que
-- "esperar abuso medido" pressupoe alguem medindo, e ninguem media: a
-- pergunta "estamos perto de cair?" foi respondida em 12/09/2026 por
-- varredura manual no painel do Supabase.
--
-- A Issue nasceu pedindo tabela nova, contagem por rota e por dia. Decisao
-- do Luiz em 14/09/2026: **nao se cria a tabela.** Volume por rota a Vercel
-- ja conta — e o medidor da fatura dela, que e o teto que chega primeiro,
-- porque o que acaba nao e o banco (3 conexoes de PostgREST servindo
-- consulta indexada) e sim a cota do plano. O sinal que faltava, recusa de
-- teto subindo, ja esta em `tentativas_de_acesso`. O que nao se tem e
-- historico, e historico e exatamente a parte que guarda dado.
--
-- Entao esta migracao cria **uma view e mais nada**. Nenhuma tabela,
-- nenhuma coluna, nenhuma linha escrita.
--
-- ## Por que a agregacao mora no banco
--
-- Porque `tentativas_de_acesso.chave` tem endereco de e-mail dentro:
-- `login:<e-mail>`, `cadastro:<ip>`, `recuperacao:<ip>` e
-- `acao:<nome>:u:<usuarioId>`. Agregar na aplicacao traria essa coluna para
-- dentro do processo e deixaria a garantia em "ninguem vai renderizar isso"
-- — que e o tipo de promessa que este projeto ja viu falhar. Aqui a chave
-- nao atravessa a fronteira: o que sai do banco ja e contagem.
--
-- O segundo motivo e o de `metricas_caixa`: agregar em JavaScript funciona
-- com poucas linhas e para de funcionar **sob abuso**, que e o unico
-- momento em que alguem abre este bloco.
--
-- ## O `revoke` nao e formalidade
--
-- A view e `security_invoker = false`, entao le a tabela ignorando a RLS
-- dela. Sem o revoke, a chave anonima leria quantas contas estao bloqueadas
-- em cada acao — um mapa de onde bater.
--
-- Idempotente: roda de novo sem erro num banco que ja tem tudo isto.
-- ============================================================================

create or replace view metricas_pressao
with (security_invoker = false) as
select
  case
    when chave like 'acao:%' then split_part(chave, ':', 2)
    else split_part(chave, ':', 1)
  end                                             as rotulo,
  count(*)                                        as chaves,
  coalesce(sum(tentativas), 0)                    as chamadas,
  count(*) filter (where bloqueado_ate > now())   as bloqueadas,
  coalesce(max(tentativas), 0)                    as pico
from tentativas_de_acesso
group by 1;

revoke select on metricas_pressao from anon, authenticated;

-- Confere que ficou fechada. Migracao que concede acesso por engano e o
-- tipo de erro que so aparece quando alguem ja leu o que nao devia.
do $$
begin
  if has_table_privilege('anon', 'metricas_pressao', 'SELECT')
     or has_table_privilege('authenticated', 'metricas_pressao', 'SELECT')
  then
    raise exception 'metricas_pressao ficou legivel por anon/authenticated';
  end if;
end $$;
