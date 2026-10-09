-- ============================================================================
-- Cota diaria de e-mail que sobrevive a limpeza (#407)
--
-- O Resend gratis manda 100 e-mails por dia, uma cota so para o app
-- inteiro. A recuperacao de senha e a confirmacao de e-mail tinham limite
-- so de 5 em 15 minutos por origem: ate 480 envios por dia do mesmo IP.
-- O codigo novo soma dois tetos diarios em `tentativas_de_acesso`: um por
-- origem e um por conta de destino.
--
-- O banco precisa saber a janela de cada chave, porque a limpeza apagava
-- toda linha com mais de uma hora que nao estivesse bloqueada. Com janela
-- de um dia, o contador sumia aos 60 minutos e recomecava do zero.
--
-- Antes ou depois do deploy, tanto faz. Sem este arquivo, os tetos diarios
-- funcionam como "por hora, a nao ser que batam no teto" — melhor que
-- nada, e o que existia antes. Com ele, valem o dia inteiro.
--
-- Seguro de rodar mais de uma vez.
-- ============================================================================

alter table tentativas_de_acesso
  add column if not exists janela_segundos integer;

-- O registro passa a gravar a janela de cada chave.
create or replace function registrar_falha_de_acesso(
  p_chave             text,
  p_janela_segundos   integer,
  p_max_tentativas    integer,
  p_bloqueio_segundos integer
)
returns timestamptz
language sql
set search_path = public, pg_temp
as $$
  insert into tentativas_de_acesso (chave, tentativas, primeira_em, janela_segundos)
  values (p_chave, 1, now(), p_janela_segundos)
  on conflict (chave) do update set
    janela_segundos = p_janela_segundos,
    -- Janela vencida recomeça do 1; dentro da janela, soma.
    tentativas = case
      when now() - tentativas_de_acesso.primeira_em
             > make_interval(secs => p_janela_segundos)
      then 1
      else tentativas_de_acesso.tentativas + 1
    end,
    primeira_em = case
      when now() - tentativas_de_acesso.primeira_em
             > make_interval(secs => p_janela_segundos)
      then now()
      else tentativas_de_acesso.primeira_em
    end,
    bloqueado_ate = case
      when (case
              when now() - tentativas_de_acesso.primeira_em
                     > make_interval(secs => p_janela_segundos)
              then 1
              else tentativas_de_acesso.tentativas + 1
            end) >= p_max_tentativas
      then now() + make_interval(secs => p_bloqueio_segundos)
      else null
    end
  returning bloqueado_ate;
$$;

-- E a limpeza nao apaga nenhuma linha antes da propria janela vencer.
create or replace function limpar_tentativas_vencidas(p_janela_segundos integer)
returns void
language sql
set search_path = public, pg_temp
as $$
  delete from tentativas_de_acesso
   where primeira_em < now() - make_interval(secs => p_janela_segundos * 4)
     and (janela_segundos is null
          or primeira_em < now() - make_interval(secs => janela_segundos))
     and (bloqueado_ate is null or bloqueado_ate < now());
$$;
