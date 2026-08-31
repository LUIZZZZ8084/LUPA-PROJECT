-- ============================================================================
-- LUPA — schema completo
--
-- Rode este arquivo UMA VEZ, num banco limpo, no SQL Editor do Supabase.
-- Ele cria tudo: tipos, tabelas, triggers, views, índices e RLS.
--
-- Depois, opcionalmente, `seed.sql` para popular Sinop com dados de exemplo.
--
-- Este schema é executado por teste automatizado (tests/unit/schema.test.ts)
-- contra um Postgres real antes de cada entrega. Não é SQL de fé.
--
-- ---------------------------------------------------------------------------
-- Como o acesso funciona, porque muda tudo abaixo
--
-- A autenticação é nossa (Argon2id + JWT), não a do Supabase Auth. Existem
-- duas chaves em jogo:
--
--   • chave anônima  — vai para o navegador. Só enxerga o que é público.
--   • chave de serviço — só no servidor. Ignora RLS e é usada pelos
--     repositórios em src/server/repositories.
--
-- Por isso as políticas abaixo liberam para `anon` apenas leitura do que
-- qualquer visitante já veria na tela. Tudo que escreve, e tudo que toca em
-- `usuarios`, passa pelo servidor.
-- ============================================================================

-- ============================================================================
-- 1. Tipos
-- ============================================================================

create type papel_usuario as enum (
  'candidato_clt',
  'prestador_servico',
  'empresa',
  'admin'
);

create type status_verificacao as enum (
  'pendente',
  'em_analise',
  'aprovado',
  'reprovado'
);

create type status_vaga as enum ('aberta', 'fechada');

create type status_candidatura as enum (
  'enviada',
  'visualizada',
  'entrevista',
  'aprovada',
  'rejeitada'
);

create type plano_empresa as enum ('trial', 'mensal');

create type status_publicacao as enum ('ativa', 'arquivada');

-- ============================================================================
-- 2. Função compartilhada
-- ============================================================================

create or replace function tocar_atualizado_em()
returns trigger language plpgsql as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

-- ============================================================================
-- 3. Identidade
-- ============================================================================

create table usuarios (
  id                   uuid primary key default gen_random_uuid(),
  email                text not null,
  -- Hash Argon2id. Nunca sai desta tabela para a aplicação: os repositórios
  -- descartam o campo antes de devolver o usuário.
  senha_hash           text not null,
  papel                papel_usuario not null,
  nome_completo        text not null,
  telefone             text not null,
  cidade               text not null default 'Sinop',
  bairro               text,
  avatar_url           text,
  email_verificado     boolean not null default false,
  telefone_verificado  boolean not null default false,
  doc_verificado       boolean not null default false,
  status_verificacao   status_verificacao not null default 'pendente',
  criado_em            timestamptz not null default now(),
  atualizado_em        timestamptz not null default now(),
  ultimo_acesso_em     timestamptz,

  constraint email_com_formato check (position('@' in email) > 1),
  constraint telefone_so_digitos check (telefone ~ '^[0-9]{10,13}$')
);

-- E-mail único ignorando maiúsculas: "Joao@" e "joao@" são a mesma pessoa, e
-- aceitar os dois cria duas contas para quem só errou o teclado.
create unique index usuarios_email_unico on usuarios (lower(email));

create index usuarios_papel_cidade_idx on usuarios (papel, cidade);
create index usuarios_criado_em_idx on usuarios (criado_em desc);

create trigger usuarios_atualizado_em
  before update on usuarios
  for each row execute function tocar_atualizado_em();

-- Quem pode aprovar verificações. No V0, apenas o fundador.
create table admins (
  usuario_id uuid primary key references usuarios(id) on delete cascade,
  criado_em  timestamptz not null default now()
);

-- ============================================================================
-- 4. Categorias de serviço
-- ============================================================================

create table categorias_servico (
  id   serial primary key,
  slug text not null unique,
  nome text not null unique
);

insert into categorias_servico (id, slug, nome) values
  (1, 'eletricista', 'Eletricista'),
  (2, 'diarista',    'Diarista'),
  (3, 'pintor',      'Pintor'),
  (4, 'encanador',   'Encanador'),
  (5, 'pedreiro',    'Pedreiro'),
  (6, 'jardineiro',  'Jardineiro'),
  (7, 'cuidador',    'Cuidador(a)');

select setval('categorias_servico_id_seq', (select max(id) from categorias_servico));

-- ============================================================================
-- 5. Perfis por papel
-- ============================================================================

create table perfis_candidato (
  usuario_id      uuid primary key references usuarios(id) on delete cascade,
  area_desejada   text,
  resumo          text,
  experiencias    jsonb not null default '[]',
  formacao        text,
  habilidades     text[] not null default '{}',
  curriculo_url   text,
  disponibilidade text,

  /*
   * "Quero que empresas me encontrem."
   *
   * Falso por padrão, e é o padrão que importa. Sem se candidatar, a
   * pessoa não aparece para empresa nenhuma — hoje ela se expõe a uma
   * empresa no momento em que decide se candidatar a ela, e essa é a
   * troca que ela entende.
   *
   * Ligar isto é ela dizendo o contrário: pode me procurar. Numa cidade
   * do tamanho de Sinop, quem está empregado e procurando outra coisa
   * pode ter o patrão atual entre as empresas cadastradas — por isso a
   * escolha é dela, explícita, e desligável a qualquer momento.
   *
   * O que a empresa alcança com isto ligado é contato, não currículo. O
   * currículo continua sendo entregue por quem se candidata.
   */
  visivel_para_empresas boolean not null default false
);

create table perfis_prestador (
  usuario_id        uuid primary key references usuarios(id) on delete cascade,
  categoria_id      int references categorias_servico(id),
  descricao         text,
  preco_inicial     numeric(10,2),
  anos_experiencia  int,
  bairros_atendidos text[] not null default '{}',
  fotos_urls        text[] not null default '{}',
  instagram         text,
  facebook          text,
  -- Denormalizados e mantidos pelo trigger em `avaliacoes`: a busca ordena
  -- por nota e não pode agregar a cada consulta.
  nota_media        numeric(2,1) not null default 0,
  total_avaliacoes  int not null default 0
);

create index perfis_prestador_categoria_idx on perfis_prestador (categoria_id);
create index perfis_prestador_nota_idx on perfis_prestador (nota_media desc);

create table perfis_empresa (
  usuario_id   uuid primary key references usuarios(id) on delete cascade,
  razao_social text not null,
  cnpj         text not null unique,
  setor        text,
  porte        text,
  site         text,
  instagram    text,
  facebook     text,
  descricao    text,
  logo_url     text,
  plano        plano_empresa not null default 'trial'
);

-- ============================================================================
-- 6. Vagas e candidaturas
-- ============================================================================

create table vagas (
  id            uuid primary key default gen_random_uuid(),
  empresa_id    uuid not null references perfis_empresa(usuario_id) on delete cascade,
  titulo        text not null,
  descricao     text not null,
  categoria     text,
  cidade        text not null default 'Sinop',
  bairro        text,
  /*
   * Rua, número, ponto de referência — texto livre, sem geocodificação.
   *
   * Aditivo ao bairro, não substituto: o ranking de proximidade continua
   * usando só bairro e cidade, porque comparar endereço livre ("Rua X,
   * 123" vs "Rua X 123") não é confiável o bastante para decidir ordem.
   * Endereço é só para quem já decidiu se candidatar saber onde é.
   *
   * Opcional na coluna para não quebrar vaga publicada antes deste campo
   * existir; a tela de publicação exige preenchido em vaga nova.
   */
  endereco      text,
  tipo_contrato text,
  salario_min   numeric(10,2),
  salario_max   numeric(10,2),

  /*
   * O que a vaga pede, para casar com as habilidades do candidato.
   *
   * Opcional: toda vaga publicada antes deste campo existir chega aqui
   * vazia, e nesse caso o casamento lê o título e a descrição. Assim o
   * bloco de recomendados funciona desde o primeiro dia e melhora quando
   * a empresa preenche — em vez de exigir preenchimento para mostrar
   * algum valor, que é a ordem que ninguém segue.
   */
  habilidades   text[] not null default '{}',

  status        status_vaga not null default 'aberta',
  visualizacoes int not null default 0,
  criado_em     timestamptz not null default now(),

  constraint salario_coerente check (
    salario_min is null or salario_max is null or salario_max >= salario_min
  )
);

create index vagas_cidade_status_idx on vagas (cidade, status, criado_em desc);
create index vagas_categoria_idx on vagas (categoria);
create index vagas_empresa_idx on vagas (empresa_id);

-- Busca textual em português, para o campo de busca livre.
create index vagas_busca_idx on vagas
  using gin (to_tsvector('portuguese', titulo || ' ' || descricao));

create table candidaturas (
  id           uuid primary key default gen_random_uuid(),
  vaga_id      uuid not null references vagas(id) on delete cascade,
  candidato_id uuid not null references usuarios(id) on delete cascade,
  status       status_candidatura not null default 'enviada',
  criado_em    timestamptz not null default now(),

  -- Uma candidatura por pessoa por vaga.
  unique (vaga_id, candidato_id)
);

create index candidaturas_vaga_idx on candidaturas (vaga_id);
create index candidaturas_candidato_idx on candidaturas (candidato_id);

-- ============================================================================
-- 7. Avaliações
-- ============================================================================

create table avaliacoes (
  id             uuid primary key default gen_random_uuid(),
  prestador_id   uuid not null references usuarios(id) on delete cascade,
  nome_avaliador text not null,
  nota           int not null check (nota between 1 and 5),
  comentario     text,
  criado_em      timestamptz not null default now()
);

create index avaliacoes_prestador_idx on avaliacoes (prestador_id, criado_em desc);

-- Mantém nota_media e total_avaliacoes em dia a cada avaliação.
create or replace function atualizar_nota_prestador()
returns trigger language plpgsql as $$
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

create trigger avaliacoes_atualizam_nota
  after insert or update or delete on avaliacoes
  for each row execute function atualizar_nota_prestador();

-- ============================================================================
-- 8. Publicações de perfil
-- ============================================================================

create table publicacoes (
  id            uuid primary key default gen_random_uuid(),
  autor_id      uuid not null references usuarios(id) on delete cascade,
  titulo        text not null,
  corpo         text not null,
  imagem_url    text,
  status        status_publicacao not null default 'ativa',
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),

  constraint titulo_com_conteudo check (length(trim(titulo)) between 3 and 120),
  constraint corpo_com_conteudo  check (length(trim(corpo)) between 10 and 3000)
);

create index publicacoes_autor_idx on publicacoes (autor_id, status, criado_em desc);

create trigger publicacoes_atualizado_em
  before update on publicacoes
  for each row execute function tocar_atualizado_em();

/*
 * O limite de 10 ativas mora aqui, não só na aplicação.
 *
 * A aplicação também confere, para dar mensagem decente antes de tentar
 * gravar. Mas duas requisições simultâneas passariam pela checagem dela e
 * criariam a décima primeira. O banco é o único lugar onde essa corrida não
 * existe.
 *
 * O lock consultivo por autor serializa inserções concorrentes do mesmo
 * perfil. `FOR UPDATE` não serve: o Postgres não aceita trava de linha junto
 * de função de agregação.
 */
create or replace function conferir_limite_publicacoes()
returns trigger language plpgsql as $$
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

create trigger publicacoes_limite
  before insert or update of status on publicacoes
  for each row execute function conferir_limite_publicacoes();

-- ============================================================================
-- 9. Verificação manual (V0)
-- ============================================================================

create table pedidos_verificacao (
  id             uuid primary key default gen_random_uuid(),
  usuario_id     uuid not null references usuarios(id) on delete cascade,
  -- Caminhos no bucket privado `verificacao`. Apagados na decisão: a política
  -- de retenção guarda apenas o status no perfil.
  documento_path text,
  selfie_path    text,
  status         status_verificacao not null default 'em_analise',
  enviado_em     timestamptz not null default now(),
  decidido_em    timestamptz,
  observacoes    text
);

create index pedidos_verificacao_status_idx
  on pedidos_verificacao (status, enviado_em);

-- ============================================================================
-- 9d. Tentativas de acesso, para o limite sobreviver ao deploy
--
-- O limite vivia num `Map` em memória da função serverless. Duas
-- consequências que o código não escondia, mas que ninguém tinha medido:
-- sumia a cada deploy, e valia por instância — com concorrência
-- suficiente, o limite virava sugestão.
--
-- Aqui ele passa a ser uma linha por chave. O que se contém é diferente em
-- cada uso, e por isso a chave também é:
--
--   • `login:<e-mail>`   — adivinhação de senha. Sucesso zera o contador.
--   • `cadastro:<origem>` — criação de conta em massa. Sucesso **conta**,
--     porque quem cria conta em massa troca de e-mail a cada tentativa.
--
-- Nada aqui identifica pessoa além do que a própria tentativa já traz, e a
-- linha morre com a janela.
-- ============================================================================

create table tentativas_de_acesso (
  chave         text primary key,
  tentativas    integer not null default 0,
  primeira_em   timestamptz not null default now(),
  bloqueado_ate timestamptz,

  constraint tentativas_nao_negativas check (tentativas >= 0)
);

-- Para a limpeza do que já venceu encontrar as linhas por índice.
create index tentativas_de_acesso_primeira_em_idx
  on tentativas_de_acesso (primeira_em);

/*
 * Registra uma falha e devolve até quando a chave está bloqueada.
 *
 * Tudo numa instrução só, de propósito. Pelo caminho ler-somar-gravar,
 * duas tentativas simultâneas leriam "4" e escreveriam "5" as duas — e a
 * sexta passaria. Num limite de acesso, essa corrida é a diferença entre
 * conter e parecer que contém.
 */
create or replace function registrar_falha_de_acesso(
  p_chave             text,
  p_janela_segundos   integer,
  p_max_tentativas    integer,
  p_bloqueio_segundos integer
)
returns timestamptz
language sql
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

/*
 * Apaga o que já venceu.
 *
 * Chamado junto com o registro de falha, não por rotina agendada: sem
 * cron, a alternativa seria a tabela crescer com toda chave vista uma vez
 * e nunca mais. Custa um `delete` por índice que quase sempre não apaga
 * nada.
 */
create or replace function limpar_tentativas_vencidas(p_janela_segundos integer)
returns void
language sql
as $$
  delete from tentativas_de_acesso
   where primeira_em < now() - make_interval(secs => p_janela_segundos * 4)
     and (bloqueado_ate is null or bloqueado_ate < now());
$$;

-- ============================================================================
-- 9c. Buscas que não acharam nada
--
-- Uma linha por termo por dia, incrementada — a mesma forma das
-- visualizações, pelo mesmo motivo: o que se usa é o agregado, e uma linha
-- por busca faria a tabela crescer com o tráfego em vez de com o
-- vocabulário.
--
-- **Não guarda quem buscou.** Nem id, nem sessão, nem endereço. Histórico
-- de busca de quem procura emprego é a mesma classe de informação que o
-- currículo: numa cidade do tamanho de Sinop, saber que fulano pesquisou
-- "vaga de motorista" três vezes esta semana diz que ele quer sair do
-- emprego atual.
--
-- O termo é gravado normalizado (minúsculas, sem acento) porque o que
-- interessa é agrupar: "Eletricista", "eletricista" e "eletrecista" só
-- viram sinal quando somam.
--
-- Para que serve: decidir entre ampliar a tabela de sinônimos e partir para
-- busca semântica. Hoje essa escolha seria palpite — não existe registro do
-- que as pessoas procuram e não encontram.
-- ============================================================================

create table buscas_sem_resultado (
  termo  text not null,
  dia    date not null default current_date,
  onde   text not null,
  total  integer not null default 0,

  primary key (termo, dia, onde),
  constraint total_nao_negativo check (total >= 0),
  constraint onde_conhecido check (onde in ('vagas', 'servicos')),
  constraint termo_com_tamanho check (length(termo) between 2 and 80)
);

create index buscas_sem_resultado_dia_idx on buscas_sem_resultado (dia desc);

/*
 * Incremento atômico, como o das visualizações.
 *
 * Duas pessoas buscando o mesmo termo no mesmo segundo pelo caminho
 * ler-somar-gravar perderiam uma contagem — e num termo raro, que é
 * justamente o que interessa aqui, perder uma é perder metade do sinal.
 */
create or replace function registrar_busca_sem_resultado(
  p_termo text,
  p_onde  text
)
returns void
language sql
as $$
  insert into buscas_sem_resultado (termo, dia, onde, total)
  values (p_termo, current_date, p_onde, 1)
  on conflict (termo, dia, onde)
  do update set total = buscas_sem_resultado.total + 1;
$$;

-- ============================================================================
-- 9b. Visualizações de vaga
--
-- Uma linha por vaga e por dia, incrementada — não uma linha por
-- visualização. Uma vaga vista mil vezes viraria mil linhas para uma
-- informação que só é usada agregada por dia, e a tabela cresceria com o
-- tráfego em vez de com o número de vagas.
--
-- Não guarda quem viu, de propósito. Deduplicar por pessoa exigiria
-- registrar qual candidato olhou qual vaga — histórico de quem está
-- procurando trabalho, a mesma informação que mantém o currículo fora de
-- qualquer view pública, porque pode custar o emprego que a pessoa ainda
-- tem.
--
-- O preço, aceito: recarregar a página infla o número. A métrica é de
-- tendência, não de audiência, e a tela diz isso.
-- ============================================================================

create table visualizacoes_vaga (
  vaga_id uuid not null references vagas(id) on delete cascade,
  dia     date not null default current_date,
  total   integer not null default 0,

  primary key (vaga_id, dia),
  constraint total_nao_negativo check (total >= 0)
);

-- A consulta do painel é sempre "as vagas desta empresa, últimos N dias".
create index visualizacoes_vaga_dia_idx on visualizacoes_vaga (dia);

/*
 * Incremento atômico.
 *
 * Duas visitas simultâneas fariam duas leituras iguais e duas escritas do
 * mesmo valor pelo caminho ler-somar-gravar — uma delas se perderia. O
 * `on conflict do update` resolve no banco, que é o único lugar onde essa
 * corrida não existe.
 */
create or replace function registrar_visualizacao(p_vaga_id uuid)
returns void
language sql
as $$
  insert into visualizacoes_vaga (vaga_id, dia, total)
  values (p_vaga_id, current_date, 1)
  on conflict (vaga_id, dia)
  do update set total = visualizacoes_vaga.total + 1;
$$;

-- ============================================================================
-- 10. Views que a aplicação consulta
--
-- `security_invoker = false` de propósito: as views rodam com a permissão do
-- dono e podem ler `usuarios`, que é fechada para `anon`. O que elas expõem
-- é uma projeção segura — nenhuma delas seleciona `senha_hash`.
-- ============================================================================

create view provider_listings
with (security_invoker = false) as
select
  pp.usuario_id                          as profile_id,
  pp.categoria_id                        as category_id,
  pp.descricao                           as description,
  pp.preco_inicial                       as starting_price,
  pp.anos_experiencia                    as years_experience,
  pp.bairros_atendidos                   as service_area,
  pp.fotos_urls                          as photo_urls,
  pp.nota_media                          as avg_rating,
  pp.total_avaliacoes                    as review_count,
  pp.instagram                           as instagram,
  pp.facebook                            as facebook,
  u.nome_completo                        as full_name,
  u.telefone                             as phone,
  u.cidade                               as city,
  u.bairro                               as neighborhood,
  u.avatar_url                           as avatar_url,
  u.telefone_verificado                  as phone_verified,
  u.doc_verificado                       as doc_verified,
  c.slug                                 as category_slug,
  jsonb_build_object('id', c.id, 'slug', c.slug, 'name', c.nome) as category
from perfis_prestador pp
join usuarios u on u.id = pp.usuario_id
join categorias_servico c on c.id = pp.categoria_id
where u.papel = 'prestador_servico';

create view job_listings
with (security_invoker = false) as
select
  v.id,
  v.empresa_id                as company_id,
  v.titulo                    as title,
  v.descricao                 as description,
  v.categoria                 as category,
  v.cidade                    as city,
  v.bairro                    as neighborhood,
  v.endereco                  as address,
  v.tipo_contrato             as contract_type,
  v.salario_min               as salary_min,
  v.salario_max               as salary_max,
  v.habilidades               as skills,
  v.status,
  v.criado_em                 as created_at,
  jsonb_build_object(
    'company_name', e.razao_social,
    'logo_url',     e.logo_url,
    'doc_verified', u.doc_verificado,
    'site',         e.site,
    'instagram',    e.instagram,
    'facebook',     e.facebook
  ) as company,
  (select count(*) from candidaturas c where c.vaga_id = v.id) as applicant_count
from vagas v
join perfis_empresa e on e.usuario_id = v.empresa_id
join usuarios u on u.id = e.usuario_id;

create view company_applications
with (security_invoker = false) as
select
  c.id,
  c.vaga_id       as job_id,
  c.candidato_id  as candidate_id,
  c.status,
  c.criado_em     as created_at,
  v.empresa_id    as company_id,
  v.titulo        as job_title,
  jsonb_build_object(
    'full_name',    u.nome_completo,
    'avatar_url',   u.avatar_url,
    'neighborhood', u.bairro,
    'city',         u.cidade,
    /*
     * Contato do candidato, para a empresa dona da vaga.
     *
     * Está aqui porque candidatura sem contato não vira entrevista — a
     * empresa recebe o currículo, não tem como chamar, e o produto para
     * na organização. Quem se candidatou consentiu com isto: é o ato de
     * se candidatar que autoriza o contato, e é ele que delimita quem
     * alcança o quê.
     *
     * A view continua revogada para a chave anônima, e o `where` de quem
     * a consulta é sempre a empresa da sessão. Sem as duas coisas, isto
     * viraria lista de telefone de quem está procurando emprego.
     */
    'email',        u.email,
    'phone',        u.telefone,
    'desired_area', pc.area_desejada,
    'availability', pc.disponibilidade,
    'summary',      pc.resumo,
    'experiences',  coalesce(pc.experiencias, '[]'::jsonb),
    'education',    pc.formacao,
    'skills',       coalesce(pc.habilidades, '{}'::text[]),
    'resume_url',   pc.curriculo_url
  ) as candidate
from candidaturas c
join vagas v on v.id = c.vaga_id
join usuarios u on u.id = c.candidato_id
left join perfis_candidato pc on pc.usuario_id = c.candidato_id;

-- Mesma candidatura, do lado de quem se candidatou: sem currículo nem
-- dado de outra pessoa, só o que ela já sabe sobre si — o estágio e a
-- vaga a que se refere.
create view candidate_applications
with (security_invoker = false) as
select
  c.id,
  c.vaga_id      as job_id,
  c.candidato_id as candidate_id,
  c.status,
  c.criado_em    as created_at,
  v.titulo       as job_title,
  e.razao_social as company_name
from candidaturas c
join vagas v on v.id = c.vaga_id
join perfis_empresa e on e.usuario_id = v.empresa_id;

/*
 * Candidatos que pediram para ser encontrados.
 *
 * O `where` é a fechadura, e está aqui de propósito em vez de na
 * aplicação: quem não ligou a opção não existe nesta view, então nenhum
 * esquecimento de filtro numa tela pode revelar alguém que não consentiu.
 *
 * O que a view expõe é o necessário para uma empresa decidir procurar e
 * conseguir falar: nome, onde mora, área desejada, habilidades e contato.
 *
 * **Currículo e resumo ficam de fora.** Quem se candidata entrega o
 * currículo junto com a candidatura; quem só está visível entregou
 * contato. São dois consentimentos diferentes, e misturá-los faria "pode
 * me procurar" significar "leia meu histórico inteiro".
 */
create view candidatos_disponiveis
with (security_invoker = false) as
select
  u.id,
  u.nome_completo  as full_name,
  u.avatar_url,
  u.cidade         as city,
  u.bairro         as neighborhood,
  u.email,
  u.telefone       as phone,
  pc.area_desejada as desired_area,
  pc.disponibilidade as availability,
  coalesce(pc.habilidades, '{}'::text[]) as skills
from perfis_candidato pc
join usuarios u on u.id = pc.usuario_id
where pc.visivel_para_empresas
  and u.papel = 'candidato_clt';

create view verification_queue
with (security_invoker = false) as
select
  pv.id,
  pv.usuario_id   as profile_id,
  u.nome_completo as full_name,
  u.papel         as role,
  cs.nome         as category,
  u.cidade        as city,
  u.telefone      as phone,
  pv.enviado_em   as submitted_at,
  pv.status
from pedidos_verificacao pv
join usuarios u on u.id = pv.usuario_id
left join perfis_prestador pp on pp.usuario_id = u.id
left join categorias_servico cs on cs.id = pp.categoria_id;

-- ============================================================================
-- 11. Views de métrica do painel administrativo
--
-- O painel recarrega a cada 15s. Deixar o Postgres agregar é muito mais
-- barato do que trazer todos os usuários para somar em JavaScript — e
-- continua barato quando a base crescer.
-- ============================================================================

create view metricas_totais
with (security_invoker = false) as
select
  (select count(*) from usuarios where papel <> 'admin')            as usuarios,
  (select count(*) from usuarios where papel = 'candidato_clt')     as candidatos,
  (select count(*) from usuarios where papel = 'prestador_servico') as prestadores,
  (select count(*) from usuarios where papel = 'empresa')           as empresas,
  (select count(*) from vagas where status = 'aberta')              as vagas_abertas;

/*
 * Fuso de Cuiabá, não UTC: um cadastro às 21h em Sinop precisa contar no dia
 * em que a pessoa se cadastrou, não no seguinte.
 */
create view metricas_cadastros_por_dia
with (security_invoker = false) as
select
  (criado_em at time zone 'America/Cuiaba')::date as dia,
  papel,
  count(*) as total
from usuarios
where papel <> 'admin'
group by 1, 2;

create view metricas_por_local
with (security_invoker = false) as
select cidade, bairro, count(*) as total
from usuarios
where papel <> 'admin'
group by cidade, bairro;

create view metricas_planos
with (security_invoker = false) as
select
  count(*) filter (where plano = 'mensal') as mensal,
  count(*) filter (where plano = 'trial')  as trial
from perfis_empresa;

-- ============================================================================
-- 12. Row Level Security
--
-- Regra geral: `anon` só lê o que qualquer visitante já veria na tela.
-- Escrita e leitura de dado sensível passam pelo servidor, com a chave de
-- serviço, que ignora RLS.
-- ============================================================================

alter table usuarios            enable row level security;
alter table admins              enable row level security;
alter table perfis_candidato    enable row level security;
alter table perfis_prestador    enable row level security;
alter table perfis_empresa      enable row level security;
alter table vagas               enable row level security;
alter table candidaturas        enable row level security;
alter table avaliacoes          enable row level security;
alter table publicacoes         enable row level security;
alter table pedidos_verificacao enable row level security;
alter table categorias_servico  enable row level security;
-- Sem política: ninguém lê nem escreve pela chave anônima. O incremento
-- passa pela função, e a leitura do painel, pela chave de serviço.
alter table visualizacoes_vaga  enable row level security;
alter table buscas_sem_resultado enable row level security;
alter table tentativas_de_acesso enable row level security;

/*
 * `usuarios` e `admins` ficam sem política nenhuma.
 *
 * Com RLS ligada e nenhuma policy, o Postgres nega tudo por padrão. É
 * proposital: a tabela guarda hash de senha, e nenhuma sessão de cliente
 * pode chegar perto dela. O acesso é exclusivamente pelo servidor.
 */

create policy "categorias sao publicas"
  on categorias_servico for select using (true);

create policy "vagas abertas sao publicas"
  on vagas for select using (status = 'aberta');

create policy "perfis de prestador sao publicos"
  on perfis_prestador for select using (true);

create policy "perfis de empresa sao publicos"
  on perfis_empresa for select using (true);

create policy "avaliacoes sao publicas"
  on avaliacoes for select using (true);

create policy "publicacoes ativas sao publicas"
  on publicacoes for select using (status = 'ativa');

/*
 * Currículo não é público. Nem todo mundo quer que o patrão atual descubra
 * que está procurando emprego — e essa informação pode custar o emprego que
 * a pessoa ainda tem. Sem policy de select, `anon` não lê.
 *
 * O mesmo vale para candidaturas e pedidos de verificação.
 */

-- ============================================================================
-- 13. Grants explícitos — o schema para de depender de fé
--
-- `with (security_invoker = false)`, usado pelas views acima porque
-- precisam juntar `usuarios` (sem nenhuma policy), faz o Postgres avaliar
-- RLS como quem *criou* a view, não como quem está consultando. Isso
-- contorna, em toda view marcada assim, o "sem policy de select, anon não
-- lê" das tabelas de baixo — e GRANT é independente de RLS: um projeto
-- Supabase concede `select` a `anon`/`authenticated` em todo objeto do
-- schema `public` por padrão, fora deste arquivo. A combinação das duas
-- coisas é o que deixava currículo, telefone e nome de quem pediu
-- verificação de fato públicos pela API REST, mesmo com RLS "correta" nas
-- tabelas e o código da aplicação já lendo `metricas_*` pela chave de
-- serviço — código correto em cima de um banco permissivo não protege
-- quem consulta a API direto.
--
-- Em vez de confiar no que o Supabase concede por fora, este arquivo
-- passa a declarar os dois lados: o que é público, de propósito, ganha
-- `select` aqui; o resto é revogado, para valer também num projeto onde o
-- padrão da plataforma já tinha concedido tudo antes deste arquivo rodar.
--
-- As roles só existem de verdade num projeto Supabase; criadas aqui como
-- no-op para que este arquivo continue rodando de uma vez num Postgres
-- limpo (é o que os testes fazem).
-- ============================================================================

do $$
begin
  if not exists (select from pg_roles where rolname = 'anon') then
    create role anon;
  end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then
    create role authenticated;
  end if;
end $$;

grant usage on schema public to anon, authenticated;

-- Público de propósito — mesma lista das policies "using (true)" ou
-- filtradas por status, acima.
grant select on categorias_servico, perfis_prestador, perfis_empresa,
  avaliacoes, vagas, publicacoes                to anon, authenticated;
grant select on job_listings, provider_listings to anon, authenticated;

-- Nunca público — currículo, candidatura, pedido de verificação e
-- métrica administrativa. Revogado de propósito, mesmo que a plataforma
-- já tenha concedido por fora: aqui é onde qualquer um lendo este
-- arquivo confirma que não vaza.
revoke select on visualizacoes_vaga            from anon, authenticated;
revoke select on buscas_sem_resultado         from anon, authenticated;
revoke select on tentativas_de_acesso         from anon, authenticated;
revoke select on company_applications          from anon, authenticated;
revoke select on candidate_applications        from anon, authenticated;
revoke select on candidatos_disponiveis        from anon, authenticated;
revoke select on verification_queue            from anon, authenticated;
revoke select on metricas_totais               from anon, authenticated;
revoke select on metricas_cadastros_por_dia    from anon, authenticated;
revoke select on metricas_por_local            from anon, authenticated;
revoke select on metricas_planos               from anon, authenticated;

/*
 * E as tabelas que guardam o mesmo dado por baixo das views.
 *
 * A RLS já barra tudo nelas — a chave anônima lê zero linha onde o banco
 * tem dezessete. O `revoke` é a segunda camada: policy criada por engano,
 * ou um `disable row level security` que alguém deixa ligado depois de
 * depurar, abriria a tabela inteira. `usuarios` guarda hash de senha, e
 * `perfis_candidato` guarda currículo — que é o registro de quem está
 * procurando emprego, a informação que pode custar o emprego atual.
 */
revoke select on usuarios         from anon, authenticated;
revoke select on admins           from anon, authenticated;
revoke select on perfis_candidato from anon, authenticated;
revoke select on candidaturas     from anon, authenticated;
