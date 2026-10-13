-- ============================================================================
-- Denúncia de foto de trabalho (#452)
--
-- Estende a denúncia (#435) às publicações. "Tirar do ar" apaga a foto de
-- vez — a publicação aqui, o arquivo no Storage pela aplicação —, porque
-- arquivada ela seguiria no ar pelo endereço e o dono poderia trazê-la de
-- volta.
--
-- **Rode antes do deploy**: o código novo manda 'publicacao' para o banco,
-- e sem o valor no tipo a denúncia de foto falha.
--
-- Seguro de rodar mais de uma vez. Termina com o revoke da #449, porque
-- recria uma função.
-- ============================================================================

alter type alvo_denuncia add value if not exists 'publicacao';

create or replace function decidir_denuncia(
  p_alvo        alvo_denuncia,
  p_alvo_id     uuid,
  p_tirar_do_ar boolean
)
returns integer
language plpgsql
set search_path = public, pg_temp
as $$
declare
  fechadas integer;
begin
  -- As denúncias primeiro: apagar a avaliação antes levaria junto as
  -- abertas, pelo trigger logo abaixo, e a decisão não ficaria registrada.
  update denuncias
     set status = case when p_tirar_do_ar
                       then 'procedente'::status_denuncia
                       else 'descartada'::status_denuncia end,
         decidida_em = now()
   where alvo = p_alvo
     and alvo_id = p_alvo_id
     and status = 'aberta';

  get diagnostics fechadas = row_count;

  if p_tirar_do_ar then
    if p_alvo = 'vaga' then
      update vagas set status = 'fechada' where id = p_alvo_id;
    elsif p_alvo = 'avaliacao' then
      -- O trigger de `avaliacoes` recalcula a nota do prestador.
      delete from avaliacoes where id = p_alvo_id;
    else
      -- A foto sai de vez, e não arquivada (#452): arquivada, ela seguiria
      -- no ar pelo endereço, e o dono poderia trazê-la de volta. O
      -- arquivo no Storage a aplicação apaga em seguida.
      delete from publicacoes where id = p_alvo_id;
    end if;
  end if;

  return fechadas;
end;
$$;

create or replace function denuncias_somem_com_o_alvo()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  delete from denuncias
   where alvo = tg_argv[0]::alvo_denuncia
     and alvo_id = old.id
     and status = 'aberta';
  return old;
end;
$$;

drop trigger if exists denuncias_da_publicacao on publicacoes;
create trigger denuncias_da_publicacao
  after delete on publicacoes
  for each row execute function denuncias_somem_com_o_alvo('publicacao');

revoke execute on all functions in schema public
  from public, anon, authenticated;
grant execute on all functions in schema public to service_role;
