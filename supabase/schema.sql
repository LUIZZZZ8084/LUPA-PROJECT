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

-- Onde o trabalho acontece (#300). Com o app aberto ao Brasil inteiro, uma
-- vaga home office em outra cidade interessa a quem está longe, e uma
-- presencial não — sem isto, as duas pareciam iguais na busca.
create type modalidade_vaga as enum ('presencial', 'home_office', 'hibrido');

create type status_candidatura as enum (
  'enviada',
  'visualizada',
  'entrevista',
  'aprovada',
  'rejeitada'
);

create type plano_empresa as enum ('trial', 'mensal');

create type status_publicacao as enum ('ativa', 'arquivada');

/*
 * Nasceu só com 'prestador_mensalidade', o primeiro uso real da cobrança.
 * Cada valor novo só entra quando ganha tela que o venda e efeito que o
 * aplique — ver o comentário de `TipoPagamento` em
 * `src/server/pagamentos/tipos.ts`.
 */
create type tipo_pagamento as enum (
  'prestador_mensalidade',
  -- Publicar vaga, para empresa e para quem contrata como pessoa fisica
  -- (#172, #489). A avulsa e pagamento unico e vira credito; os tres planos
  -- sao assinatura mensal, nao consomem credito e se distinguem pelo limite
  -- de vagas no ar ao mesmo tempo (5, 10 e ilimitado). Os pacotes de 5 e 10
  -- que existiram antes (`empresa_pacote_5`, `empresa_pacote_10`) deixaram
  -- de ser vendidos; o valor continua no enum de quem veio de antes, porque
  -- o Postgres nao tira valor de enum, e nenhuma compra nova o usa.
  'empresa_vaga_avulsa',
  'empresa_plano_5',
  'empresa_plano_10',
  'empresa_mensal',
  -- Gerador de currículo em PDF (#47): compra única, libera para sempre.
  'curriculo_pdf'
);

/*
 * Os seis desfechos de uma cobranca.
 *
 * `estornado` e `contestado` sao os dois que tiram dinheiro, e sao
 * separados de proposito (#179): o efeito no app e o mesmo, mas um foi
 * decisao nossa e o outro e disputa aberta pelo cliente no cartao, que
 * custa taxa e da para contestar de volta. A informacao chega uma vez so,
 * no webhook, e some se nao for gravada ali.
 */
create type status_pagamento as enum
  ('pendente', 'aprovado', 'rejeitado', 'cancelado', 'estornado',
   'contestado');

/*
 * O ciclo de vida de uma assinatura recorrente, espelhando o
 * `preapproval` do Mercado Pago:
 *
 *   pendente  — criada, esperando a pessoa autorizar no checkout
 *   ativa     — autorizada; o Mercado Pago cobra sozinho todo mês
 *   pausada   — o Mercado Pago suspendeu (cartão recusado, por exemplo)
 *   cancelada — não cobra mais, e não volta atrás
 *
 * `cancelada` é diferente de mensalidade vencida: cancelar interrompe as
 * cobranças **futuras** e não devolve nada — os dias já pagos continuam
 * valendo até o fim do período.
 */
create type status_assinatura as enum
  ('pendente', 'ativa', 'pausada', 'cancelada');

-- ============================================================================
-- 2. Função compartilhada
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
  /*
   * CPF de candidato e prestador — as duas pessoas físicas da plataforma.
   *
   * Fica aqui, e não em `perfis_prestador`, por uma razão de privacidade
   * que não é simetria com o CNPJ: `perfis_prestador` tem policy
   * `using (true)` e `grant select` para `anon` — o que entra lá é
   * público. `usuarios` só é alcançada pela chave de serviço, no
   * servidor, e é onde já mora o hash de senha.
   *
   * CNPJ pode ser público porque é registro público; CPF não é.
   *
   * Nulo só sobra para empresa (que se identifica por CNPJ) e para quem
   * se cadastrou antes de o CPF virar obrigatório — essa conta antiga
   * preenche ao virar prestador, em `virarPrestador`.
   */
  cpf                  text,
  telefone             text not null,
  /*
   * "Sinop - MT": a cidade vai com o estado, porque 232 nomes de município
   * se repetem entre estados (#301). Sem padrão: um padrão aqui é a cidade
   * de quem não escolheu nenhuma, e o app não tem mais cidade inicial.
   */
  cidade               text not null,
  /*
   * LEGADO (#321, decisao do Luiz em 01/10/2026): a aplicacao nao le nem
   * grava mais esta coluna. O bairro de uma pessoa nao filtra nem ordena
   * nada, e o cadastro e o perfil pedem so a cidade. Fica no banco porque
   * apagar dado de producao e decisao do Luiz, e a coluna e inofensiva:
   * `usuarios` nao tem grant para `anon`. Sai numa migracao futura, junto
   * com as views que ainda a expoem (`provider_listings`,
   * `company_applications`, `candidatos_disponiveis`). A
   * `metricas_por_local` saiu na #471, trocada por contas por estado e por
   * cidade.
   */
  bairro               text,
  avatar_url           text,
  email_verificado     boolean not null default false,
  telefone_verificado  boolean not null default false,
  doc_verificado       boolean not null default false,
  status_verificacao   status_verificacao not null default 'pendente',
  criado_em            timestamptz not null default now(),
  atualizado_em        timestamptz not null default now(),
  ultimo_acesso_em     timestamptz,
  /*
   * Corte de revogacao de sessao (#225).
   *
   * A sessao e um JWT de 7 dias e nao mora no banco — o app roda em
   * funcoes serverless, e consulta a mais e latencia para quem esta em 3G.
   * O preco registrado era nao conseguir revogar antes de expirar: quem
   * trocava a senha desconfiando de acesso indevido continuava com o
   * invasor dentro por ate uma semana.
   *
   * Esta coluna e o corte: todo token emitido **antes** dela deixa de
   * valer. Nao e sessao no banco — e uma data por pessoa, lida de uma
   * lista curta e cacheada, nao uma consulta por requisicao.
   *
   * Nulo e o normal: quem nunca trocou a senha nao tem corte. E a lista
   * que a aplicacao le so traz os ultimos 7 dias, porque token mais velho
   * que isso ja expirou sozinho — a tabela nao cresce com o tempo.
   */
  sessoes_validas_desde timestamptz,

  /*
   * Quando a pessoa usou o teste gratis da mensalidade de prestador (#392).
   *
   * O teste e um por conta: sem este registro, cancelar e assinar de novo
   * criava outra assinatura e outra concessao, e quem repetisse o ciclo a
   * cada 15 dias nunca pagava. A coluna mora em `usuarios`, e nao em
   * `perfis_prestador`, de proposito: aquela tabela e lida pela chave
   * anonima, e esta e uma informacao de cobranca que ninguem de fora tem
   * motivo para ver.
   *
   * Nulo e o normal. E o preenchimento e atomico (`update ... where
   * teste_gratis_usado_em is null`), para duas ativacoes simultaneas nao
   * concederem o teste duas vezes.
   */
  teste_gratis_usado_em timestamptz,

  constraint email_com_formato check (position('@' in email) > 1),
  constraint telefone_so_digitos check (telefone ~ '^[0-9]{10,13}$')
);

-- Um CPF, uma conta. Parcial porque empresa não tem CPF nenhum — é CNPJ —
-- e nulo não pode colidir com nulo.
create unique index usuarios_cpf_idx on usuarios (cpf) where cpf is not null;

-- E-mail único ignorando maiúsculas: "Joao@" e "joao@" são a mesma pessoa, e
-- aceitar os dois cria duas contas para quem só errou o teclado.
create unique index usuarios_email_unico on usuarios (lower(email));

create index usuarios_papel_cidade_idx on usuarios (papel, cidade);
create index usuarios_criado_em_idx on usuarios (criado_em desc);

/*
 * Cobre a unica consulta que le o corte de sessao: "quem revogou nos
 * ultimos 7 dias" (#225).
 *
 * Parcial porque a esmagadora maioria das linhas e nula — quem nunca
 * trocou a senha nao tem corte. Indice cheio aqui seria pagar escrita em
 * toda conta por uma leitura que nunca olha para elas.
 */
create index usuarios_sessoes_validas_desde_idx
  on usuarios (sessoes_validas_desde)
  where sessoes_validas_desde is not null;

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
  (1,  'eletricista',        'Eletricista'),
  (2,  'diarista',           'Diarista'),
  (3,  'pintor',             'Pintor'),
  (4,  'encanador',          'Encanador'),
  (5,  'pedreiro',           'Pedreiro'),
  (6,  'jardineiro',         'Jardineiro'),
  (7,  'cuidador',           'Cuidador(a)'),
  (8,  'programador',        'Programador(a)'),
  (9,  'designer',           'Designer Gráfico(a)'),
  (10, 'tecnico-enfermagem', 'Técnico(a) de Enfermagem'),
  (11, 'farmaceutico',       'Farmacêutico(a)'),
  (12, 'fisioterapeuta',     'Fisioterapeuta'),
  (13, 'cabeleireiro',       'Cabeleireiro(a)'),
  (14, 'manicure',           'Manicure'),
  (15, 'fotografo',          'Fotógrafo(a)'),
  (16, 'personal-trainer',   'Personal Trainer'),
  (17, 'mecanico',           'Mecânico(a)'),
  (18, 'marceneiro', 'Marceneiro(a)'),
  (19, 'serralheiro', 'Serralheiro(a)'),
  (20, 'soldador', 'Soldador(a)'),
  (21, 'gesseiro', 'Gesseiro(a)'),
  (22, 'vidraceiro', 'Vidraceiro(a)'),
  (23, 'azulejista', 'Azulejista'),
  (24, 'tecnico-ar-condicionado', 'Técnico(a) de Ar-condicionado'),
  (25, 'tecnico-informatica', 'Técnico(a) de Informática'),
  (26, 'tecnico-celular', 'Técnico(a) de Celular'),
  (27, 'chaveiro', 'Chaveiro(a)'),
  (28, 'montador-moveis', 'Montador(a) de Móveis'),
  (29, 'instalador-energia-solar', 'Instalador(a) de Energia Solar'),
  (30, 'instalador-cameras', 'Instalador(a) de Câmeras e Alarmes'),
  (31, 'dedetizador', 'Dedetizador(a)'),
  (32, 'piscineiro', 'Piscineiro(a)'),
  (33, 'motoboy', 'Motoboy / Entregador(a)'),
  (34, 'motorista-particular', 'Motorista Particular'),
  (35, 'baba', 'Babá'),
  (36, 'passadeira', 'Passadeira'),
  (37, 'costureira', 'Costureira(o)'),
  (38, 'cozinheiro', 'Cozinheiro(a)'),
  (39, 'confeiteiro', 'Confeiteiro(a) / Padeiro(a)'),
  (40, 'churrasqueiro', 'Churrasqueiro(a)'),
  (41, 'garcom', 'Garçom / Garçonete'),
  (42, 'barbeiro', 'Barbeiro(a)'),
  (43, 'maquiador', 'Maquiador(a)'),
  (44, 'massoterapeuta', 'Massoterapeuta'),
  (45, 'esteticista', 'Esteticista'),
  (46, 'contador', 'Contador(a)'),
  (47, 'professor-particular', 'Professor(a) Particular'),
  (48, 'veterinario', 'Veterinário(a)'),
  (49, 'tosador', 'Banho e Tosa'),
  (50, 'tratorista', 'Tratorista / Operador(a) de Máquinas');

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
  visivel_para_empresas boolean not null default false,

  /*
   * Gerador de currículo pago (#47) — compra única de R$ 14,90, que
   * libera a geração e o download do PDF para sempre. Não é assinatura:
   * não há data de validade para guardar, só o interruptor.
   */
  gerador_curriculo_liberado boolean not null default false
);

create table perfis_prestador (
  usuario_id        uuid primary key references usuarios(id) on delete cascade,
  categoria_id      int references categorias_servico(id),
  descricao         text,
  preco_inicial     numeric(10,2),
  anos_experiencia  int,
  /* LEGADO (#321): a aplicacao nao le nem grava mais — ver `usuarios.bairro`. */
  bairros_atendidos text[] not null default '{}',
  fotos_urls        text[] not null default '{}',
  instagram         text,
  facebook          text,
  /*
   * CNPJ opcional de quem presta serviço por uma empresa — MEI, ME,
   * EIRELI, LTDA, tanto faz (#138, corrigido na #140: o primeiro desenho
   * só servia para MEI). O CPF em `usuarios` continua sendo a verificação
   * de base de todo prestador; isto é divulgação a mais, nunca
   * substituto.
   *
   * Pode morar aqui, e não em `usuarios`, porque CNPJ é registro público
   * — ao contrário do CPF, que esta tabela nunca pode receber: ela é lida
   * pela chave anônima.
   *
   * `razao_social` é o nome que a **Receita** devolveu, não o que a
   * pessoa digitou: é o que permite a quem vai contratar ler o nome da
   * empresa e julgar se faz sentido para o serviço anunciado. Sem ele, o
   * perfil mostraria um número solto, que não informa nada.
   */
  cnpj              text,
  cnpj_verificado   boolean not null default false,
  razao_social      text,
  -- Denormalizados e mantidos pelo trigger em `avaliacoes`: a busca ordena
  -- por nota e não pode agregar a cada consulta.
  nota_media        numeric(2,1) not null default 0,
  total_avaliacoes  int not null default 0,

  /*
   * Mensalidade de prestador. `null` até a primeira cobrança aprovada;
   * quando o prazo passa, o perfil some da vitrine de `/servicos` — o
   * filtro mora em `getProviders`, não aqui, pela mesma razão de
   * `doc_verified`: filtrar na view esconderia o prestador do próprio
   * perfil.
   */
  mensalidade_valida_ate timestamptz
);

create index perfis_prestador_categoria_idx on perfis_prestador (categoria_id);
create index perfis_prestador_nota_idx on perfis_prestador (nota_media desc);
create unique index perfis_prestador_cnpj_idx
  on perfis_prestador (cnpj) where cnpj is not null;


create table perfis_empresa (
  usuario_id   uuid primary key references usuarios(id) on delete cascade,
  razao_social text not null,
  /*
   * Opcional desde 03/09/2026 (#138): contratante pode ser produtor rural
   * ou autônomo, com CPF em vez de CNPJ — decisão já registrada na #129.
   * O CPF de quem escolhe essa via mora em `usuarios`, nunca aqui: esta
   * tabela é lida pela chave anônima, e CNPJ pode ser público porque é
   * registro público — CPF não.
   */
  cnpj         text,
  setor        text,
  porte        text,
  site         text,
  instagram    text,
  facebook     text,
  descricao    text,
  logo_url     text,
  plano        plano_empresa not null default 'trial'
);

create unique index perfis_empresa_cnpj_idx
  on perfis_empresa (cnpj) where cnpj is not null;

-- ============================================================================
-- 6. Vagas e candidaturas
-- ============================================================================

create table vagas (
  id            uuid primary key default gen_random_uuid(),
  empresa_id    uuid not null references perfis_empresa(usuario_id) on delete cascade,
  titulo        text not null,
  descricao     text not null,
  categoria     text,
  cidade        text not null,
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
  /*
   * Presencial, home office ou híbrido (#300). Opcional na coluna, pelo
   * mesmo motivo do endereço: vaga publicada antes deste campo existir
   * continua válida e só não mostra o selo. A tela de publicação exige.
   */
  modalidade    modalidade_vaga,
  /*
   * Vaga para pessoa com deficiência (#456). A empresa responde na hora de
   * publicar, e a busca filtra por isto.
   *
   * `not null default false`, ao contrário da modalidade: aqui o valor
   * neutro existe e é verdadeiro para o que já foi publicado — vaga antiga
   * não era para PCD —, então não há linha "sem resposta" para tratar. A
   * tela é que exige a escolha explícita em vaga nova.
   *
   * É só da vaga. A Lupa não guarda se o candidato é PCD: é dado de saúde,
   * e o filtro funciona sem isso.
   */
  para_pcd      boolean not null default false,
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

  /*
   * Até três perguntas de sim ou não para quem se candidata (#491), como
   * `[{"texto": "Tem CNH D?", "eliminatoria": true}, ...]`.
   *
   * Dentro da própria linha da vaga, e não numa tabela à parte, por uma
   * razão de atomicidade: publicar é uma instrução só, e a vaga não pode
   * ficar no ar sem as perguntas que a empresa escreveu — nem as perguntas
   * sem a vaga. Como o resto da vaga, não se edita depois de publicada.
   *
   * O teto de três é do banco, e não só da tela: a lista é lida por todo
   * candidato que abre a vaga.
   */
  perguntas     jsonb not null default '[]'::jsonb
    check (jsonb_typeof(perguntas) = 'array'
           and jsonb_array_length(perguntas) <= 3),

  status        status_vaga not null default 'aberta',
  visualizacoes int not null default 0,
  criado_em     timestamptz not null default now(),

  /*
   * Toda vaga expira 30 dias depois de publicada. Expirada some da busca
   * e da home, mas a empresa reativa de graça, na hora que quiser —
   * reativar só estende esta coluna, nunca muda `status`. "Expirada" é
   * sempre calculado daqui (`vagaExpirada`, em src/lib/format.ts), nunca
   * guardado como um terceiro valor de `status`: a correção mora na
   * consulta, não num job agendado que pode atrasar.
   */
  expira_em     timestamptz not null default (now() + interval '30 days'),

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
  /*
   * O que a pessoa respondeu às perguntas de triagem da vaga (#491), na
   * ordem delas: `true` é Sim. Nulo quando a vaga não tinha pergunta — a
   * maioria, e toda candidatura anterior a elas. Chega à empresa dona da
   * vaga junto do resto da candidatura, e some com ela: excluir a conta
   * apaga a candidatura em cascata.
   */
  respostas    jsonb check (respostas is null or jsonb_typeof(respostas) = 'array'),

  -- Uma candidatura por pessoa por vaga.
  unique (vaga_id, candidato_id)
);

create index candidaturas_vaga_idx on candidaturas (vaga_id);
create index candidaturas_candidato_idx on candidaturas (candidato_id);

/*
 * Vaga com perguntas não recebe candidatura sem respostas (#491).
 *
 * A aplicação confere antes, para dar a mensagem; o banco confere de novo
 * porque "sem responder todas, não envia" é regra de produto, e a action
 * pode ser chamada direto. A resposta tem de ser uma lista de verdadeiro e
 * falso do mesmo tamanho da lista de perguntas. Vaga **sem** pergunta
 * descarta o que vier: lixo na entrada não vira dado.
 *
 * Só no `insert`: as respostas nunca mudam, e mover a candidatura de
 * estágio não pode esbarrar numa regra de quando ela nasceu.
 */
create or replace function candidatura_confere_triagem()
returns trigger language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_perguntas jsonb;
begin
  select perguntas into v_perguntas from vagas where id = new.vaga_id;

  if coalesce(jsonb_array_length(v_perguntas), 0) = 0 then
    new.respostas := null;
    return new;
  end if;

  if new.respostas is null
     or jsonb_typeof(new.respostas) <> 'array'
     or jsonb_array_length(new.respostas) <> jsonb_array_length(v_perguntas)
     or exists (
       select 1 from jsonb_array_elements(new.respostas) r
       where jsonb_typeof(r) <> 'boolean'
     ) then
    raise exception 'respostas de triagem incompletas'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger candidaturas_confere_triagem
  before insert on candidaturas
  for each row execute function candidatura_confere_triagem();

-- ============================================================================
-- 7. Avaliações
-- ============================================================================

create table avaliacoes (
  id             uuid primary key default gen_random_uuid(),
  prestador_id   uuid not null references usuarios(id) on delete cascade,
  /*
   * De quem é a avaliação.
   *
   * Nulo nas de demonstração, que vieram do seed antes de existir escrita
   * pela aplicação. `on delete set null` porque a avaliação é informação
   * do prestador também: apagar a conta de quem escreveu não pode apagar
   * a reputação de quem foi avaliado.
   */
  avaliador_id   uuid references usuarios(id) on delete set null,
  -- Mantido para as linhas antigas e para exibir sem outra consulta.
  nome_avaliador text not null,
  nota           int not null check (nota between 1 and 5),
  comentario     text,
  criado_em      timestamptz not null default now(),

  -- Ninguém avalia a si mesmo.
  constraint avaliacao_nao_e_de_si_mesmo
    check (avaliador_id is null or avaliador_id <> prestador_id)
);

create index avaliacoes_prestador_idx on avaliacoes (prestador_id, criado_em desc);

/*
 * Chave estrangeira sem índice é varredura na tabela filha toda vez que a
 * pai muda (#210). Postgres indexa a chave primária sozinho, a estrangeira
 * não — e quem paga a conta é o `delete` em `usuarios`, que precisa
 * conferir cada referência.
 *
 * Criar agora, com dezenas de linhas, é instantâneo. Criar depois, com a
 * tabela crescida, trava escrita.
 */
create index avaliacoes_avaliador_idx on avaliacoes (avaliador_id);

/*
 * Uma avaliação por pessoa, por prestador.
 *
 * A checagem na aplicação não basta: dois envios simultâneos passam os
 * dois e gravam os dois. Parcial porque as de demonstração não têm dono e
 * nulo não colide com nulo.
 */
create unique index avaliacoes_um_por_pessoa_idx
  on avaliacoes (prestador_id, avaliador_id)
  where avaliador_id is not null;

-- Mantém nota_media e total_avaliacoes em dia a cada avaliação.
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

create trigger avaliacoes_atualizam_nota
  after insert or update or delete on avaliacoes
  for each row execute function atualizar_nota_prestador();

/*
 * A avaliação de quem exclui a conta fica, e sem o nome (#235).
 *
 * Ela é informação do prestador, por isso `avaliador_id` é `on delete set
 * null` e a linha sobrevive. Mas o nome é texto copiado em
 * `nome_avaliador`, e sem isto continuaria lá depois de a pessoa pedir a
 * exclusão — o contrário do que a Política de Privacidade promete. A conta
 * é apagada pelo suporte, direto no banco, então a garantia mora aqui e
 * não numa tela: `before delete`, porque depois do `set null` já não há
 * como saber de quem era a avaliação.
 */
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

create trigger usuarios_anonimizam_avaliacoes
  before delete on usuarios
  for each row execute function anonimizar_avaliacoes_do_autor();

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

-- Mesma razão da #210.
create index pedidos_verificacao_usuario_idx
  on pedidos_verificacao (usuario_id);

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
  -- A janela com que a chave foi registrada (#407). A limpeza a respeita:
  -- sem isto, a cota diária de e-mail era apagada depois de uma hora e
  -- recomeçava do zero.
  janela_segundos integer,

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

/*
 * Apaga o que já venceu.
 *
 * Chamado junto com o registro de falha, não por rotina agendada: sem
 * cron, a alternativa seria a tabela crescer com toda chave vista uma vez
 * e nunca mais. Custa um `delete` por índice que quase sempre não apaga
 * nada.
 *
 * **Nenhuma linha sai antes de a própria janela vencer (#407).** O corte
 * era só "quatro janelas de login", uma hora. Servia enquanto toda janela
 * era de minutos; a cota diária de e-mail é de um dia, e era apagada aos
 * 60 minutos sem ter batido no teto — quem mandasse um pouco abaixo dele a
 * cada hora nunca era barrado. A primeira condição continua sendo a do
 * índice; a segunda só poupa quem declarou janela mais longa.
 */
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

-- ============================================================================
-- 9b-bis. Mensagens de suporte (#235)
--
-- O canal de suporte por formulario existe porque o publico deste app abre
-- o e-mail no celular e muitas vezes nao tem cliente de e-mail configurado.
-- Mandar a pessoa "escrever para contato@" e mandar metade dela desistir.
--
-- **A linha e apagada junto com a conta.** `on delete cascade`, e nao `set
-- null`: a mensagem carrega nome, e-mail e texto livre que a propria pessoa
-- escreveu sobre a situacao dela. Guardar isso depois de ela pedir exclusao
-- contradiria a Politica de Privacidade, que promete apagar o que
-- identifica.
--
-- `usuario_id` e nulavel porque quem nao consegue entrar e justamente quem
-- mais precisa do suporte — a pagina e aberta.
--
-- `respondida_em` existe para o admin saber o que ja tratou. Nao guarda a
-- resposta: ela sai por e-mail, e copiar o texto para ca seria guardar a
-- conversa inteira sem necessidade.
-- ============================================================================

create type assunto_suporte as enum (
  'conta',
  'pagamento',
  'anuncio',
  'privacidade',
  'outro'
);

create table mensagens_suporte (
  id            uuid primary key default gen_random_uuid(),
  usuario_id    uuid references usuarios(id) on delete cascade,
  nome          text not null,
  email         text not null,
  assunto       assunto_suporte not null,
  mensagem      text not null,
  criado_em     timestamptz not null default now(),
  respondida_em timestamptz,

  constraint mensagem_com_conteudo check (length(trim(mensagem)) between 10 and 4000),
  constraint suporte_email_com_formato check (position('@' in email) > 1)
);

-- A chave estrangeira precisa de índice próprio: apagar uma conta varre a
-- tabela para achar as mensagens dela. Faltou quando a tabela nasceu, e foi
-- o advisor do Supabase que pegou; o teste "toda chave estrangeira tem
-- índice", em schema.test.ts, é o que impede a próxima.
create index mensagens_suporte_usuario_idx
  on mensagens_suporte (usuario_id);

-- A fila do admin le por data, e so o que ainda nao foi respondido.
create index mensagens_suporte_abertas_idx
  on mensagens_suporte (criado_em desc)
  where respondida_em is null;

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
set search_path = public, pg_temp
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
set search_path = public, pg_temp
as $$
  insert into visualizacoes_vaga (vaga_id, dia, total)
  values (p_vaga_id, current_date, 1)
  on conflict (vaga_id, dia)
  do update set total = visualizacoes_vaga.total + 1;
$$;


-- ----------------------------------------------------------------------------
-- Notificação push (#48)
--
-- Avisar quem procura quando aparece vaga na cidade e categoria dela. Numa
-- plataforma que saiu da busca do Google, ninguém chega sozinho: uma vaga
-- só é vista por quem resolver abrir o app naquele dia, e vaga boa em Sinop
-- some em dois dias.
-- ----------------------------------------------------------------------------

/*
 * A preferência — o mínimo para entregar o aviso, e nada além.
 *
 * Uma linha por pessoa: ela escolhe uma cidade e, opcionalmente, uma
 * categoria. `categoria` nula significa "todas", que é o padrão de quem
 * quer saber de tudo na cidade dela.
 *
 * **Não há histórico do que foi enviado, de propósito.** Guardar "avisamos
 * fulano sobre estas doze vagas" seria reconstruir exatamente o histórico
 * de quem procura emprego que `buscas_sem_resultado` recusa guardar — numa
 * cidade do tamanho de Sinop, isso diz que a pessoa quer sair do emprego
 * atual. A diferença desta tabela é que a pessoa pediu para ser avisada, e
 * a preferência atual é o mínimo necessário para cumprir o pedido.
 *
 * Sem policy e sem grant: nenhuma chave anônima alcança. Saber quem está
 * de olho em vaga de motorista é a mesma classe de informação do currículo.
 */
create table preferencias_notificacao (
  usuario_id  uuid primary key references usuarios(id) on delete cascade,
  cidade      text not null,
  categoria   text,
  criado_em   timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- O disparo pergunta "quem quer saber de vaga nesta cidade?" a cada vaga
-- publicada; sem índice isso varre a tabela inteira.
create index preferencias_notificacao_cidade_idx
  on preferencias_notificacao (cidade);

/*
 * A inscrição do aparelho, devolvida pelo navegador.
 *
 * São várias por pessoa, e de propósito: quem usa o celular e o computador
 * quer ser avisado nos dois. `endpoint` é único porque é ele que identifica
 * o aparelho para o serviço de push — reinscrever o mesmo aparelho troca a
 * linha em vez de duplicar o aviso.
 *
 * `p256dh` e `auth` são as chaves que cifram a mensagem até o aparelho.
 * São segredo por aparelho: quem as tiver consegue mandar notificação em
 * nome da Lupa para aquela pessoa. Ficam aqui pela mesma razão que o hash
 * de senha fica em `usuarios` — fora do alcance da chave anônima.
 */
create table inscricoes_push (
  id          uuid primary key default gen_random_uuid(),
  usuario_id  uuid not null references usuarios(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  criado_em   timestamptz not null default now()
);

create index inscricoes_push_usuario_idx on inscricoes_push (usuario_id);

alter table preferencias_notificacao enable row level security;
alter table inscricoes_push enable row level security;

-- ============================================================================
-- 9d2. Carteira de quem publica vaga
--
-- Creditos de vaga e validade do plano mensal (#172). Tabela propria, e
-- nao colunas em `perfis_empresa`, por um motivo so: aquela tabela e
-- lida pela chave anonima, e quantos creditos uma empresa tem e dado
-- comercial dela — nao registro publico como o CNPJ. Mesmo raciocinio
-- que mantem o CPF em `usuarios`.
--
-- A chave e `usuario_id` e nao `empresa_id` de proposito: desde a #129
-- quem publica vaga tambem pode ser prestador contratando ajudante, e ele
-- nao tem perfil de empresa quando compra o primeiro credito.
-- ============================================================================

create table carteiras_vaga (
  usuario_id             uuid primary key references usuarios(id) on delete cascade,
  /*
   * Nunca negativo, e a garantia e do banco. O consumo e um `update ...
   * where creditos_vaga > 0`, condicional na propria instrucao: duas
   * publicacoes simultaneas com um credito so nao podem passar as duas,
   * e "le, decide, grava" deixaria passar — a mesma corrida que o limite
   * de publicacoes ja resolve no banco.
   */
  creditos_vaga          int not null default 0 check (creditos_vaga >= 0),
  /** Enquanto valer, publica ate o limite do plano e nao gasta credito. */
  mensalidade_valida_ate timestamptz,
  /*
   * Quantas vagas o plano deixa no ar ao mesmo tempo (#489). Nulo e o
   * ilimitado — e tambem o valor de quem nunca teve plano, o que nao
   * importa: sem `mensalidade_valida_ate` em dia, o limite nao e lido.
   * Guardado aqui e nao deduzido do tipo da assinatura porque o estorno e
   * a expiracao agem sobre a carteira, e a carteira nao conhece assinatura.
   */
  plano_vagas_no_ar      int check (plano_vagas_no_ar is null
                                    or plano_vagas_no_ar > 0),
  /*
   * A primeira vaga gratis e uma por conta (#489). Preenchido pela mesma
   * instrucao que a concede (`reivindicar_primeira_vaga_gratis`), para duas
   * publicacoes simultaneas nao usarem as duas a mesma vaga gratis.
   */
  primeira_vaga_gratis_usada_em timestamptz,
  criado_em              timestamptz not null default now(),
  atualizado_em          timestamptz not null default now()
);

create trigger carteiras_vaga_atualizado_em
  before update on carteiras_vaga
  for each row execute function tocar_atualizado_em();

alter table carteiras_vaga enable row level security;

/*
 * As tres operacoes da carteira vivem no banco, e nao na aplicacao, pelo
 * mesmo motivo do contador de tentativas e do limite de publicacoes:
 * "le, decide, grava" perde a corrida. Duas cobrancas aprovadas quase
 * juntas creditariam o mesmo total, e duas publicacoes simultaneas com um
 * credito so passariam as duas.
 */

-- Soma (ou subtrai, com quantidade negativa) creditos, criando a carteira
-- se ainda nao existir. Nunca abaixo de zero: quem ja gastou o que
-- comprou e depois contestou a cobranca para em zero, nao fica devendo.
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

-- Gasta um credito, e so se houver. Zero linhas devolvidas quer dizer
-- "nao tinha" — quem chama le isso como recusa, nao como erro.
create or replace function consumir_credito_vaga(p_usuario uuid)
returns setof carteiras_vaga language sql
set search_path = public, pg_temp
as $$
  update carteiras_vaga
  set creditos_vaga = creditos_vaga - 1
  where usuario_id = p_usuario and creditos_vaga > 0
  returning *;
$$;

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


-- A mesma conta da mensalidade de prestador, atômica no banco (#348).
--
-- Antes isto era um ler-modificar-gravar na aplicação
-- (`estenderMensalidade`, em `src/server/prestadores/servico.ts`): lia a
-- validade, calculava `max(agora, atual) + dias` em JS e gravava. Duas
-- extensões concorrentes para o mesmo prestador leriam a mesma base e uma
-- se perderia. A máquina de estado do pagamento serializava as chamadas, e
-- por isso a corrida não acontecia na prática — mas depender de um
-- invariante de outro módulo é o que esta função remove: a conta vive onde
-- a corrida não existe, igual à do plano de vaga logo acima.
--
-- `p_dias is null` revoga, do mesmo jeito. A linha existe sempre que a
-- pessoa é prestador; zero linhas devolvidas é "não tem perfil", e a
-- aplicação traduz isso no 404 de sempre.
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


-- ============================================================================
-- 9e. Assinaturas recorrentes
--
-- Uma linha por `preapproval` do Mercado Pago: a autorização que ele
-- guarda para cobrar sozinho todo mês (#170). É o que separa "assinatura"
-- de "pagamento avulso" — antes disto o prestador pagava uma vez, ganhava
-- 30 dias, e no dia 31 sumia da vitrine sem cobrança nova e sem aviso.
--
-- `checkout_url` fica guardado de propósito: quem clica em assinar, é
-- mandado ao Mercado Pago e volta sem autorizar precisa cair no **mesmo**
-- checkout ao clicar de novo. Criar um `preapproval` novo a cada clique
-- deixaria autorizações órfãs no Mercado Pago, e duas autorizadas seriam
-- duas cobranças por mês na mesma pessoa.
--
-- Sem grant para `anon`/`authenticated`, como `pagamentos`.
-- ============================================================================

create table assinaturas (
  id                 uuid primary key default gen_random_uuid(),
  usuario_id         uuid not null references usuarios(id) on delete cascade,
  tipo               tipo_pagamento not null,
  valor_centavos     int not null check (valor_centavos > 0),
  status             status_assinatura not null default 'pendente',
  mp_preapproval_id  text,
  checkout_url       text,
  criado_em          timestamptz not null default now(),
  atualizado_em      timestamptz not null default now()
);

create index assinaturas_usuario_idx on assinaturas (usuario_id, criado_em desc);

/*
 * Uma linha por assinatura do Mercado Pago. Não há índice único por
 * pessoa de propósito: a garantia de "uma viva por vez" é da aplicação,
 * porque uma violação de unicidade aqui aconteceria **dentro do
 * webhook** — e webhook que responde 500 é webhook que o Mercado Pago
 * reenvia para sempre.
 */
create unique index assinaturas_mp_idx
  on assinaturas (mp_preapproval_id) where mp_preapproval_id is not null;

create trigger assinaturas_atualizado_em
  before update on assinaturas
  for each row execute function tocar_atualizado_em();

alter table assinaturas enable row level security;

-- ============================================================================
-- 9f. Pagamentos
--
-- Toda cobrança que a Lupa cria, avulsa ou recorrente, com o que o
-- Mercado Pago respondeu. Sem grant para `anon`/`authenticated` — mesmo
-- tratamento de `usuarios`, porque é dado financeiro e só o servidor, com
-- a chave de serviço, precisa alcançar.
-- ============================================================================

create table pagamentos (
  id               uuid primary key default gen_random_uuid(),
  usuario_id       uuid not null references usuarios(id) on delete cascade,
  tipo             tipo_pagamento not null,
  valor_centavos   int not null check (valor_centavos > 0),
  status           status_pagamento not null default 'pendente',
  -- Preferência do Checkout Pro, nas compras únicas (#172). Nula nas
  -- parcelas da recorrência, que não passam por preferência nenhuma.
  mp_preference_id text,
  mp_payment_id    text,
  -- Nulo em cobrança avulsa; preenchido em toda parcela gerada pela
  -- recorrência. `on delete set null` porque a cobrança aconteceu de
  -- verdade e não some junto com a autorização que a originou.
  assinatura_id    uuid references assinaturas(id) on delete set null,
  metadata         jsonb not null default '{}',
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now()
);

create index pagamentos_usuario_idx on pagamentos (usuario_id, criado_em desc);

-- A mesma razão da #210, e esta é a que mais cresce: uma linha por
-- cobrança, para sempre.
create index pagamentos_assinatura_idx on pagamentos (assinatura_id);

create unique index pagamentos_mp_payment_idx
  on pagamentos (mp_payment_id) where mp_payment_id is not null;

create trigger pagamentos_atualizado_em
  before update on pagamentos
  for each row execute function tocar_atualizado_em();

alter table pagamentos enable row level security;


-- ============================================================================
-- 9g. Recuperacao de senha
--
-- A migracao 0001 trocou o Supabase Auth por autenticacao propria, e o
-- AGENTS.md registra desde entao o que se perdeu junto: verificacao de
-- e-mail e recuperacao de senha, que vinham de graca. Esta tabela e a
-- segunda metade dessa divida (#174).
--
-- **O token nunca e guardado em claro.** Quem lesse esta tabela — um
-- backup exposto, um acesso de leitura mal concedido — poderia trocar a
-- senha de qualquer conta. Guarda-se o SHA-256 dele; o valor original so
-- existe no e-mail que a pessoa recebeu.
--
-- SHA-256 e nao Argon2 de proposito: Argon2 e caro justamente para
-- resistir a forca bruta contra senha de gente, que tem pouca entropia.
-- Aqui o segredo e aleatorio de 256 bits — nao ha o que adivinhar, e o
-- custo por tentativa nao compra nada.
--
-- Sem grant para `anon`/`authenticated`: e material de troca de senha.
-- ============================================================================

/*
 * Para que serve o token (#227).
 *
 * A tabela nasceu so para recuperacao de senha; a verificacao de e-mail
 * usa o mesmo material — segredo aleatorio, guardado em hash, de uso
 * unico, com prazo — e nao merece uma tabela gemea que diverge na
 * primeira vez que alguem mexe num lado so.
 *
 * O que ela **nao** pode ser e um token que serve para as duas coisas. O
 * de verificacao e mandado com mais liberdade (no cadastro, e a cada
 * "reenviar"), e se ele tambem trocasse senha, cada reenvio seria um link
 * de redefinicao a mais circulando. Por isso a finalidade entra na
 * instrucao que **consome** o token, junto do hash — e nao numa checagem
 * antes, que duas requisicoes simultaneas atravessariam.
 */
create type finalidade_token as enum ('recuperacao', 'verificacao_email');

create table tokens_recuperacao (
  id         uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references usuarios(id) on delete cascade,
  /* SHA-256 do token, em hex. Unico: dois pedidos nao colidem. */
  token_hash text not null unique,
  finalidade finalidade_token not null default 'recuperacao',
  expira_em  timestamptz not null,
  /*
   * Uso unico. Marcado na propria instrucao que troca a senha (`where
   * usado_em is null`), e nao por "le, decide, grava": dois cliques no
   * mesmo link, ou um link vazado sendo usado em paralelo, passariam os
   * dois por uma leitura anterior.
   */
  usado_em   timestamptz,
  criado_em  timestamptz not null default now()
);

create index tokens_recuperacao_usuario_idx
  on tokens_recuperacao (usuario_id, criado_em desc);

alter table tokens_recuperacao enable row level security;

-- ============================================================================
-- 9z. Excluir a própria conta (#423)
--
-- LGPD, art. 18, VI. Uma função só, para tudo acontecer na mesma transação:
-- metade excluída e metade não é o pior estado possível — a pessoa não
-- consegue mais entrar e os dados dela continuam aqui. A aplicação cancela
-- a assinatura no Mercado Pago **antes** de chamar, e apaga os arquivos do
-- Storage **depois**.
--
-- Não é `security definer`: quem chama é a chave de serviço.
-- ============================================================================

create or replace function excluir_conta(p_usuario uuid)
returns void
language plpgsql
set search_path = public, pg_temp
as $$
begin
  -- O que a pessoa publicou, pediu ou guardou aqui.
  delete from candidaturas             where candidato_id = p_usuario;
  delete from publicacoes              where autor_id     = p_usuario;
  delete from avaliacoes               where prestador_id = p_usuario;
  delete from perfis_candidato         where usuario_id   = p_usuario;
  delete from perfis_prestador         where usuario_id   = p_usuario;
  -- Leva junto as vagas dela, e as candidaturas a elas.
  delete from perfis_empresa           where usuario_id   = p_usuario;
  delete from pedidos_verificacao      where usuario_id   = p_usuario;
  delete from preferencias_notificacao where usuario_id   = p_usuario;
  delete from inscricoes_push          where usuario_id   = p_usuario;
  delete from tokens_recuperacao       where usuario_id   = p_usuario;
  delete from carteiras_vaga           where usuario_id   = p_usuario;
  delete from admins                   where usuario_id   = p_usuario;

  -- A avaliação que ela escreveu é reputação de outra pessoa: fica, sem
  -- o nome de quem escreveu.
  update avaliacoes
     set avaliador_id = null, nome_avaliador = 'Conta excluída'
   where avaliador_id = p_usuario;

  -- Mensagens ao suporte: a tabela existe em produção e não neste
  -- arquivo, por isso o `execute`.
  if to_regclass('public.mensagens_suporte') is not null then
    execute 'delete from public.mensagens_suporte where usuario_id = $1'
      using p_usuario;
  end if;

  -- A linha fica, sem nada que identifique a pessoa: pagamentos e
  -- assinaturas apontam para ela, e apagá-la levaria o histórico do caixa
  -- junto, em cascata. Senha que nenhum hash produz, e-mail e CPF livres
  -- para uma conta nova, e toda sessão cortada.
  update usuarios
     set email                 = 'excluida-' || id || '@excluida.lupapp.invalid',
         nome_completo         = 'Conta excluída',
         telefone              = '0000000000',
         cpf                   = null,
         bairro                = null,
         avatar_url            = null,
         senha_hash            = '!conta-excluida',
         email_verificado      = false,
         telefone_verificado   = false,
         doc_verificado        = false,
         ultimo_acesso_em      = null,
         sessoes_validas_desde = now()
   where id = p_usuario;
end;
$$;

-- ============================================================================
-- 9y. Denúncias (#435)
--
-- Vaga golpista e avaliação abusiva chegam ao admin por aqui, e só ele
-- decide: nada sai do ar sozinho. A tabela é fechada para as chaves
-- anônima e autenticada (revoke lá embaixo); quem escreve e lê é a chave
-- de serviço, e o denunciante nunca aparece para o denunciado.
-- ============================================================================

create type alvo_denuncia as enum ('vaga', 'avaliacao', 'publicacao');
create type motivo_denuncia as enum ('golpe', 'falsa', 'ofensiva', 'outro');
create type status_denuncia as enum ('aberta', 'procedente', 'descartada');

create table denuncias (
  id             uuid primary key default gen_random_uuid(),
  alvo           alvo_denuncia not null,
  alvo_id        uuid not null,
  -- Para a avaliação e a foto (#452), de quem é o perfil onde ela aparece:
  -- é o caminho que o admin abre para ver o contexto. Nulo na vaga, cujo
  -- id já é o caminho.
  prestador_id   uuid references usuarios(id) on delete cascade,
  -- `set null`: a conta anonimizada não é apagada (#423), mas se um dia
  -- for, a denúncia que ela fez continua valendo como sinal.
  denunciante_id uuid references usuarios(id) on delete set null,
  motivo         motivo_denuncia not null,
  detalhe        text check (detalhe is null or char_length(detalhe) <= 500),
  status         status_denuncia not null default 'aberta',
  criada_em      timestamptz not null default now(),
  decidida_em    timestamptz
);

-- Uma denúncia aberta por pessoa e por alvo: a segunda não soma nada, e
-- dez cliques da mesma pessoa não podem parecer dez pessoas.
create unique index denuncias_uma_aberta_por_pessoa
  on denuncias (alvo, alvo_id, denunciante_id)
  where status = 'aberta' and denunciante_id is not null;

create index denuncias_abertas_idx
  on denuncias (criada_em)
  where status = 'aberta';

create index denuncias_denunciante_idx on denuncias (denunciante_id);

-- O dono do perfil da avaliação ou da foto denunciada (#452). É chave
-- estrangeira com `on delete cascade`: sem índice, excluir qualquer conta
-- varreria a tabela de denúncias inteira atrás dos filhos. Faltou na #452,
-- e o teste de chave estrangeira sem índice (#235) pegou.
create index denuncias_prestador_idx on denuncias (prestador_id);

alter table denuncias enable row level security;

-- Tirar do ar e fechar as denúncias do mesmo alvo numa transação só:
-- metade feita seria a vaga fora do ar com a denúncia ainda aberta no
-- painel, ou o contrário — a denúncia fechada com a vaga no ar.
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

-- O alvo sumiu — a conta do dono foi excluída (#423), e a vaga e as
-- avaliações do perfil foram junto —, e a denúncia aberta sumiria com ele:
-- sem isso o painel mostraria algo que ninguém consegue mais abrir. As já
-- decididas ficam, como registro.
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

drop trigger if exists denuncias_da_vaga on vagas;
create trigger denuncias_da_vaga
  after delete on vagas
  for each row execute function denuncias_somem_com_o_alvo('vaga');

drop trigger if exists denuncias_da_avaliacao on avaliacoes;
create trigger denuncias_da_avaliacao
  after delete on avaliacoes
  for each row execute function denuncias_somem_com_o_alvo('avaliacao');

drop trigger if exists denuncias_da_publicacao on publicacoes;
create trigger denuncias_da_publicacao
  after delete on publicacoes
  for each row execute function denuncias_somem_com_o_alvo('publicacao');

-- ============================================================================
-- 9x. Custos mensais (#473)
--
-- O que o Lupa precisa pagar todo mês, para o painel comparar com a receita
-- que se repete ("O Lupa já se paga?", #471). Era uma constante no código;
-- o Luiz pediu para acrescentar contador, aluguel e o que mais vier sem
-- depender de deploy. Dado da empresa, não de ninguém do app: só a chave
-- de serviço alcança, e só o admin edita, pela tela.
-- ============================================================================

create table custos_mensais (
  id             uuid primary key default gen_random_uuid(),
  -- A ordem de cobertura é a de cadastro: a receita paga o primeiro custo
  -- inteiro antes de chegar ao segundo.
  ordem          bigint generated by default as identity,
  nome           text not null check (char_length(btrim(nome)) between 2 and 60),
  -- Em centavos, por mês. Até R$ 100.000,00: acima disso é engano.
  valor_centavos integer not null
                 check (valor_centavos between 1 and 10000000),
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);

create trigger custos_mensais_atualizado_em
  before update on custos_mensais
  for each row execute function tocar_atualizado_em();

alter table custos_mensais enable row level security;

-- Nasce com os dois custos que a #471 deixou escritos no código, os mesmos
-- de `CUSTOS_INICIAIS`: estimativas do Supabase Pro e do Vercel Pro.
insert into custos_mensais (nome, valor_centavos) values ('Supabase Pro', 13300);
insert into custos_mensais (nome, valor_centavos) values ('Vercel Pro', 10700);

-- ============================================================================
-- 9y. Parceiros (#505)
--
-- Quem usa a Lupa de graça por acordo com o Luiz. A chave é o e-mail, e não a
-- conta: a parceria costuma ser fechada antes do cadastro. O benefício chega
-- à conta com aquele e-mail quando ela confirma que o endereço é dela, e mora
-- nas mesmas colunas que o pagamento usa (a mensalidade do prestador e o plano
-- de vagas da carteira) — por isso esta tabela não é lida por vitrine nem por
-- publicação, só pelo admin. Dado da empresa: só a chave de serviço alcança.
-- ============================================================================

create table parceiros (
  id            uuid primary key default gen_random_uuid(),
  -- Minúsculas, como `usuarios.email`, para a comparação ser de igual.
  email         text not null check (email = lower(btrim(email)) and email like '%_@_%'),
  nome          text not null check (char_length(btrim(nome)) between 2 and 80),
  -- Até quando vale; nulo é sem prazo.
  valido_ate    timestamptz,
  criado_em     timestamptz not null default now(),
  criado_por    uuid references usuarios(id) on delete set null,
  -- Encerrar guarda o registro: quem teve parceria, e até quando.
  encerrado_em  timestamptz,
  -- A conta que recebeu o benefício, e a validade gravada nela. Encerrar
  -- compara com esta data: o que a conta pagou além dela fica.
  usuario_id    uuid references usuarios(id) on delete set null,
  concedido_em  timestamptz,
  concedido_ate timestamptz
);

-- Uma parceria aberta por e-mail: duas dariam dois prazos para a mesma conta.
create unique index parceiros_um_aberto_por_email
  on parceiros (email) where encerrado_em is null;

-- Toda chave estrangeira tem índice: excluir uma conta procura por elas.
create index parceiros_usuario_idx on parceiros (usuario_id);
create index parceiros_criado_por_idx on parceiros (criado_por);

alter table parceiros enable row level security;

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
  jsonb_build_object('id', c.id, 'slug', c.slug, 'name', c.nome) as category,
  pp.mensalidade_valida_ate              as subscription_valid_until
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
    /*
     * Quem contrata é pessoa ou empresa (#129).
     *
     * Vai o booleano derivado do CNPJ, nunca o documento: esta view é
     * lida pela chave anônima. CNPJ pode ser público porque é registro
     * público; o CPF de quem contrata como pessoa física mora em
     * `usuarios` e não sai de lá.
     *
     * Quem procura emprego tem direito de saber se está tratando com uma
     * empresa registrada ou com uma pessoa — muda o que ela pode
     * conferir antes de ir a uma entrevista.
     */
    'pessoa_fisica', (e.cnpj is null),
    'site',         e.site,
    'instagram',    e.instagram,
    'facebook',     e.facebook
  ) as company,
  (select count(*) from candidaturas c where c.vaga_id = v.id) as applicant_count,
  v.expira_em                 as expires_at,
  -- Por último: `create or replace view` só aceita coluna nova no fim, e é
  -- assim que `aplica-modalidade-vaga.sql` chega a um banco vivo (#300).
  v.modalidade                as work_mode,
  -- E depois dela, pela mesma regra (#456): coluna nova só no fim.
  v.para_pcd                  as for_pcd,
  -- E as perguntas de triagem (#491), pela mesma regra.
  v.perguntas                 as screening_questions
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
  ) as candidate,
  -- Coluna nova só no fim (#491): as respostas à triagem e as perguntas a
  -- que elas se referem, para a empresa ler uma ao lado da outra.
  c.respostas     as answers,
  v.perguntas     as job_questions
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

/*
 * Conta é quem pode entrar (#471). A linha de quem excluiu a própria conta
 * (#423) fica em `usuarios`, anonimizada e com a senha que nenhum hash
 * produz, porque `pagamentos` aponta para ela — e as views de métrica a
 * somavam como gente. E vaga aberta é a que ainda aparece na busca: vencida
 * continua `aberta` no status (#157), e contava.
 */
create view metricas_totais
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

/*
 * Contas por estado e por cidade, separadas por papel (#471).
 *
 * Substituem `metricas_por_local`, que agrupava por cidade **e bairro** —
 * o bairro de pessoa saiu do produto na #321 — e não dizia o papel. O
 * estado sai do próprio valor gravado ("Sinop - MT", #301); o que não tem
 * esse formato fica com estado nulo, e a tela o mostra como "sem estado",
 * em vez de sumir com a conta.
 *
 * A mesma conta existe em TypeScript, para a demonstração
 * (`agregarContasPorLugar`), e o `schema.test.ts` roda as duas sobre a
 * mesma entrada: o recorte do estado é regra de texto, e regra de texto
 * escrita em duas linguagens é a que diverge sem ninguém ver.
 */
create view metricas_contas_por_estado
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

create view metricas_contas_por_cidade
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

/*
 * O funil de cada papel e a receita que se repete (#471).
 *
 * A pergunta é a do Luiz em 15/10/2026: quanto falta para o Lupa pagar o
 * próprio custo. Cada papel tem o caminho dele até virar receita, e o
 * funil mostra onde ele para:
 *
 * - candidato: conta → visível para empresas → se candidatou;
 * - prestador: conta → na vitrine (CPF conferido e mensalidade em dia,
 *   a mesma regra de `getProviders`) → assinante;
 * - empresa: conta → conferida (CNPJ na Receita, ou CPF no cadastro) →
 *   publicou vaga → comprou.
 *
 * `recorrente_ativo_centavos` soma as assinaturas ativas pelo valor de
 * cada uma, não pela tabela de hoje: quem assinou antes de um preço mudar
 * continua pagando o que assinou. Inclui quem está no teste grátis, que é
 * `ativa` antes da primeira cobrança. `entrou_30_dias_centavos` é o que foi
 * aprovado nos últimos 30 dias, pacotes inclusive.
 *
 * Só contagem sai daqui. A mesma regra existe em TypeScript
 * (`montarFunil`), e o `schema.test.ts` compara as duas.
 */
create view metricas_funil
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

/*
 * O caixa: o que entrou e o que saiu, de verdade (#179).
 *
 * A view antiga (`metricas_planos`) contava `perfis_empresa.plano`, coluna
 * que nunca teve quem escrevesse nela — entao `mensal` era sempre zero e a
 * "receita estimada" do painel era zero vezes um preco. Estado declarado
 * sem produtor, a armadilha que este schema ja registrou tres vezes.
 *
 * Aqui a fonte e `pagamentos`, que e onde o dinheiro de verdade passa.
 * Decisao do Luiz em 10/09/2026: todo valor que entra deve ser
 * registrado, e o que sai tambem.
 *
 * As duas saidas ficam em colunas separadas porque significam coisas
 * diferentes: `estornado` foi devolucao nossa, `contestado` e disputa no
 * cartao — custa taxa e e sinal de fraude. Somadas dariam um numero certo
 * e uma leitura errada.
 *
 * `recorrente` separa o que se repete sozinho todo mes do que foi compra
 * unica: sao as duas metades de qualquer projecao, e misturadas fazem um
 * mes bom de pacotes parecer receita previsivel.
 */
create view metricas_caixa
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

/*
 * Pressao nos tetos: quem esta encostando no limite, agrupado (#207).
 *
 * A Issue nasceu pedindo tabela nova — contagem por rota e por dia, no
 * padrao de `buscas_sem_resultado`. Decisao do Luiz em 14/09/2026: nao se
 * cria a tabela. Volume por rota a Vercel ja conta (e o medidor da fatura
 * dela, que e justamente o teto que chega primeiro), e o sinal que falta —
 * recusa de teto subindo — ja esta aqui em `tentativas_de_acesso`. O que
 * nao se tem e historico, e historico e exatamente a parte que guarda
 * dado.
 *
 * ## Por que uma view, e nao um `group by` em JavaScript
 *
 * **Porque `chave` tem e-mail dentro.** Os formatos sao
 * `login:<e-mail>`, `cadastro:<ip>`, `recuperacao:<ip>` e
 * `acao:<nome>:u:<usuarioId>`. Agregar na aplicacao significaria trazer
 * essa coluna para dentro do processo e confiar que ninguem, nunca, a
 * renderize — e "confiar que ninguem renderize" e o tipo de garantia que
 * este projeto ja viu falhar. Aqui a chave nao sai do banco: o que
 * atravessa a fronteira ja e contagem.
 *
 * O segundo motivo e o mesmo de `metricas_caixa`: agregar na aplicacao
 * funciona hoje, com poucas linhas, e para de funcionar **exatamente sob
 * abuso** — que e o unico momento em que alguem vai abrir este bloco.
 *
 * ## O rotulo nao carrega dado de ninguem
 *
 * Para `acao:<nome>:...` o rotulo e `<nome>`, que vem de `ORCAMENTOS` —
 * literal do nosso codigo, nunca entrada de usuario. Para os tres de
 * autenticacao o rotulo e so o prefixo (`login`, `cadastro`,
 * `recuperacao`): o resto da chave fica para tras de proposito.
 *
 * ## O que cada numero responde
 *
 * `chaves` e `pico` juntos separam transito de abuso: vinte chaves com
 * tres chamadas cada e um dia movimentado; uma chave com sessenta e uma
 * pessoa — ou um script — sozinha. `bloqueadas` e o sinal que a decisao
 * do Cloudflare esta esperando: enquanto for zero, nao ha abuso medido.
 *
 * A janela e a propria retencao da tabela — `limpar_tentativas_vencidas`
 * apaga o que passou de quatro janelas. Logo isto e sempre "agora", nunca
 * tendencia, e a tela diz isso.
 */
create view metricas_pressao
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
alter table mensagens_suporte    enable row level security;

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
  if not exists (select from pg_roles where rolname = 'service_role') then
    create role service_role;
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
-- Guarda nome, e-mail e texto livre sobre a situacao de quem escreveu
-- (#235). Nunca publica, nem para quem tem sessao: mensagem de suporte de
-- outra pessoa nao e assunto de ninguem.
revoke select on mensagens_suporte           from anon, authenticated;
revoke select on tentativas_de_acesso         from anon, authenticated;
revoke select on company_applications          from anon, authenticated;
revoke select on candidate_applications        from anon, authenticated;
revoke select on candidatos_disponiveis        from anon, authenticated;
revoke select on verification_queue            from anon, authenticated;
revoke select on metricas_totais               from anon, authenticated;
revoke select on metricas_cadastros_por_dia    from anon, authenticated;
revoke select on metricas_contas_por_estado    from anon, authenticated;
revoke select on metricas_contas_por_cidade    from anon, authenticated;
revoke select on metricas_funil                from anon, authenticated;
revoke select on metricas_caixa                from anon, authenticated;

/*
 * E a pressao nos tetos (#207). O `revoke` aqui nao e formalidade: a view
 * e `security_invoker = false`, entao ela le `tentativas_de_acesso`
 * ignorando a RLS da tabela. Sem esta linha, a chave anonima leria quantas
 * contas estao bloqueadas em cada acao — um mapa de onde bater.
 */
revoke select on metricas_pressao              from anon, authenticated;

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

/*
 * `pedidos_verificacao` guarda documento e selfie de gente de verdade até
 * o admin decidir. Faltava aqui desde sempre — a RLS barrava (zero
 * policies nega tudo), então nunca vazou, mas era só uma camada.
 */
revoke select on pedidos_verificacao from anon, authenticated;

/*
 * E as duas dos avisos (#48), pelo mesmo raciocínio.
 *
 * `preferencias_notificacao` diz o que a pessoa está procurando — a mesma
 * classe de informação que o currículo, e o motivo de
 * `buscas_sem_resultado` não guardar quem buscou. `inscricoes_push` guarda
 * as chaves que cifram a mensagem até o aparelho: quem as tiver manda
 * notificação em nome da Lupa.
 *
 * Estas duas linhas faltaram quando as tabelas nasceram, e a varredura de
 * grants não pegou: no PGlite não existem os grants padrão que o Supabase
 * concede, então `has_table_privilege` já respondia `false` sem `revoke`
 * nenhum. O teste passava pelo motivo errado, e produção ficou com o
 * `select` aberto até alguém conferir o banco de verdade.
 */
revoke select on preferencias_notificacao from anon, authenticated;
revoke select on inscricoes_push          from anon, authenticated;

/*
 * E `pagamentos` (#159): valor, status e o id no Mercado Pago de cada
 * cobrança. Mesmo tratamento de `usuarios`.
 */
revoke select on pagamentos       from anon, authenticated;
revoke select on assinaturas      from anon, authenticated;
revoke select on carteiras_vaga   from anon, authenticated;
revoke select on tokens_recuperacao from anon, authenticated;

-- Denúncia diz quem denunciou quem (#435): só a chave de serviço.
revoke select on denuncias from anon, authenticated;
revoke select on custos_mensais from anon, authenticated;
-- Quem tem parceria, e até quando (#505): dado da empresa.
revoke select on parceiros from anon, authenticated;

/*
 * E a escrita, em tudo (#421). O Supabase concede a `anon` e
 * `authenticated` insert, update, delete, truncate, references e trigger em
 * toda tabela e view do schema público, e a aplicação nunca escreve com
 * essas chaves — toda escrita passa pela de serviço. O RLS sem policy de
 * escrita já barra; isto é a segunda camada, como o `revoke select` acima é
 * para a leitura. O `alter default privileges` cobre as tabelas criadas
 * depois. Em banco existente: `aplica-anon-sem-escrita.sql`.
 */
revoke insert, update, delete, truncate, references, trigger
  on all tables in schema public from anon, authenticated;

alter default privileges in schema public
  revoke insert, update, delete, truncate, references, trigger
  on tables from anon, authenticated;

/*
 * E as funções (#449). O Supabase publica toda função do schema público
 * pela API, e por padrão as duas chaves podem executá-las. Nenhuma daqui
 * roda com o privilégio do dono, e as chaves não escrevem em nada, então
 * hoje isso não alcança coisa alguma — mas a garantia moraria numa
 * propriedade de cada função, e uma `security definer` criada por engano
 * viraria porta aberta. Quem chama função é só a chave de serviço.
 *
 * Fica no fim do arquivo para alcançar toda função criada acima. Em banco
 * existente, e depois de qualquer `aplica-*.sql` que crie função:
 * `aplica-funcoes-so-servico.sql`.
 */
revoke execute on all functions in schema public
  from public, anon, authenticated;
grant execute on all functions in schema public to service_role;

alter default privileges in schema public
  revoke execute on functions from anon, authenticated;
