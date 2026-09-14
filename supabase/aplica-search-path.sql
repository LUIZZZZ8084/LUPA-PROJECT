-- ============================================================================
-- search_path fixo nas funcoes do banco (#219)
--
-- O linter do Supabase reprova dez funcoes em `public` com
-- `function_search_path_mutable`. Funcao sem `search_path` fixo resolve
-- nomes pelo caminho de **quem chama**: quem conseguir criar um objeto num
-- schema que venha antes sombreia uma tabela — e ai `creditar_vaga` credita
-- na tabela do atacante, ou `registrar_falha_de_acesso` conta numa copia e
-- o limite deixa de limitar.
--
-- **Nao era exploravel**, e a distincao importa: `anon` e `authenticated`
-- nao tem CREATE no schema `public`, e nao existe nenhuma funcao
-- `security definer` aqui. Sem CREATE nao ha onde plantar o objeto que
-- sombreia; sem `security definer` nenhuma funcao empresta privilegio. Isto
-- e endurecimento, nao fechamento de porta — e quem ler "dez avisos de
-- seguranca" sem essa frase conclui a coisa errada.
--
-- O que muda isso no futuro e plausivel e silencioso: alguem conceder
-- CREATE a uma role, ou escrever a primeira funcao `security definer` sem
-- fixar o caminho. Por isso ha teste varrendo o schema.
--
-- `pg_temp` vai **por ultimo**. Assim tabela temporaria criada por quem
-- chama e procurada depois de `public`, e nao sombreia nada. `pg_temp`
-- primeiro seria trocar um buraco por outro.
--
-- Idempotente: e o mesmo `create or replace` do schema.sql, com a clausula.
-- ============================================================================

create or replace function tocar_atualizado_em()
returns trigger language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

create or replace function atualizar_nota_prestador()
returns trigger language plpgsql
set search_path = public, pg_temp
as $$
declare
  alvo uuid := coalesce(new.prestador_id, old.prestador_id);
begin
  update perfis_prestador p
  set nota_media = coalesce(round(agg.media, 1), 0),
      total_avaliacoes = coalesce(agg.total, 0)
  from (
    select avg(nota)::numeric as media, count(*) as total
    from avaliacoes
    where prestador_id = alvo
  ) agg
  where p.usuario_id = alvo;

  return null;
end;
$$;

create or replace function conferir_limite_publicacoes()
returns trigger language plpgsql
set search_path = public, pg_temp
as $$
declare
  ativas int;
  limite constant int := 10;
begin
  if new.status <> 'ativa' then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtext(new.autor_id::text));

  select count(*) into ativas
  from publicacoes
  where autor_id = new.autor_id
    and status = 'ativa'
    and id <> new.id;

  if ativas >= limite then
    raise exception 'limite de % publicações ativas atingido', limite
      using errcode = 'check_violation',
            hint = 'arquive uma publicação antiga para abrir espaço';
  end if;

  return new;
end;
$$;

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
  insert into tentativas_de_acesso (chave, tentativas, primeira_em)
  values (p_chave, 1, now())
  on conflict (chave) do update set
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

create or replace function limpar_tentativas_vencidas(p_janela_segundos integer)
returns void
language sql
set search_path = public, pg_temp
as $$
  delete from tentativas_de_acesso
   where primeira_em < now() - make_interval(secs => p_janela_segundos * 4)
     and (bloqueado_ate is null or bloqueado_ate < now());
$$;

create or replace function registrar_busca_sem_resultado(
  p_termo text,
  p_onde  text
)
returns void
language sql
set search_path = public, pg_temp
as $$
  insert into buscas_sem_resultado (termo, dia, onde, total)
  values (p_termo, current_date, p_onde, 1)
  on conflict (termo, dia, onde)
  do update set total = buscas_sem_resultado.total + 1;
$$;

create or replace function registrar_visualizacao(p_vaga_id uuid)
returns void
language sql
set search_path = public, pg_temp
as $$
  insert into visualizacoes_vaga (vaga_id, dia, total)
  values (p_vaga_id, current_date, 1)
  on conflict (vaga_id, dia)
  do update set total = visualizacoes_vaga.total + 1;
$$;

create or replace function creditar_vaga(p_usuario uuid, p_quantidade int)
returns setof carteiras_vaga language sql
set search_path = public, pg_temp
as $$
  insert into carteiras_vaga (usuario_id, creditos_vaga)
  values (p_usuario, greatest(0, p_quantidade))
  on conflict (usuario_id) do update
    set creditos_vaga = greatest(0, carteiras_vaga.creditos_vaga + p_quantidade)
  returning *;
$$;

create or replace function consumir_credito_vaga(p_usuario uuid)
returns setof carteiras_vaga language sql
set search_path = public, pg_temp
as $$
  update carteiras_vaga
  set creditos_vaga = creditos_vaga - 1
  where usuario_id = p_usuario and creditos_vaga > 0
  returning *;
$$;

create or replace function estender_mensalidade_vaga(
  p_usuario uuid,
  p_dias int
)
returns setof carteiras_vaga language sql
set search_path = public, pg_temp
as $$
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
