-- ============================================================================
-- A avaliação de quem exclui a conta fica, e sem o nome (#235)
--
-- `avaliacoes.avaliador_id` é `on delete set null`: a avaliação é informação
-- do prestador e sobrevive à exclusão de quem a escreveu. Mas o nome fica
-- copiado em `nome_avaliador`, e continuava lá depois da exclusão — o
-- contrário do que a Política de Privacidade promete. Este gatilho troca o
-- nome por "Conta excluída" antes de a conta sair.
--
-- Avaliação de conta já excluída antes disto não tem como ser achada: o
-- `avaliador_id` dela já é nulo, igual ao das avaliações do seed.
--
-- Pode rodar antes ou depois do deploy, e rodar de novo não muda nada.
-- ============================================================================

create or replace function anonimizar_avaliacoes_do_autor()
returns trigger language plpgsql
set search_path = public, pg_temp
as $$
begin
  update avaliacoes
  set nome_avaliador = 'Conta excluída'
  where avaliador_id = old.id;

  return old;
end;
$$;

drop trigger if exists usuarios_anonimizam_avaliacoes on usuarios;

create trigger usuarios_anonimizam_avaliacoes
  before delete on usuarios
  for each row execute function anonimizar_avaliacoes_do_autor();

-- ─── Conferência: tem de voltar 1 ──────────────────────────────────────
select count(*) as gatilho_instalado
  from pg_trigger
 where tgname = 'usuarios_anonimizam_avaliacoes';
