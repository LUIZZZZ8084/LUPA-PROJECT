-- =============================================================================
-- LUPA — o nome na avaliação acompanha o nome da conta (#304)
--
-- Rode UMA VEZ no banco de produção, no SQL Editor do Supabase. Banco novo
-- não precisa: o `schema.sql` já traz tudo isto.
--
-- Por que existe um arquivo separado: `schema.sql` é escrito para rodar de
-- uma vez num banco limpo e é a fonte da verdade do que o banco deveria
-- ser. Rodá-lo inteiro num banco com dados falharia no primeiro `create
-- type` — e, se alguém "resolvesse" isso pondo `drop` no topo, apagaria a
-- produção no dia em que abrisse o arquivo errado.
--
-- O problema: `avaliacoes.nome_avaliador` é uma cópia do nome, gravada no
-- dia da avaliação. Quem trocava o nome da conta continuava aparecendo com
-- o nome antigo no comentário, e não tinha como corrigir.
--
-- Sem isto aplicado o app continua funcionando; só o nome nas avaliações
-- segue velho depois de uma troca. É degradação, não queda.
--
-- Tudo aqui é repetível: rodar duas vezes não muda o resultado. O ajuste das
-- linhas antigas só toca avaliação com dono cujo nome está diferente do da
-- conta, e nunca as do seed, que não têm `avaliador_id`.
-- =============================================================================

create or replace function atualizar_nome_nas_avaliacoes()
returns trigger language plpgsql
set search_path = public, pg_temp
as $$
begin
  update avaliacoes
  set nome_avaliador = new.nome_completo
  where avaliador_id = new.id
    and nome_avaliador is distinct from new.nome_completo;

  return null;
end;
$$;

drop trigger if exists usuarios_renomeiam_avaliacoes on usuarios;

create trigger usuarios_renomeiam_avaliacoes
  after update of nome_completo on usuarios
  for each row
  when (old.nome_completo is distinct from new.nome_completo)
  execute function atualizar_nome_nas_avaliacoes();

-- As avaliações que já ficaram com o nome antigo.
update avaliacoes a
set nome_avaliador = u.nome_completo
from usuarios u
where u.id = a.avaliador_id
  and a.nome_avaliador is distinct from u.nome_completo;
