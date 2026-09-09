-- =============================================================================
-- LUPA — avisos de vaga nova (#48)
--
-- Rode UMA VEZ no banco de produção, no SQL Editor do Supabase. Banco novo
-- não precisa: o `schema.sql` já traz tudo isto.
--
-- Sem isto aplicado, ligar os avisos falha e a tela mostra o erro. O resto
-- do app não é afetado — nenhuma consulta existente toca estas tabelas.
--
-- Nenhum grant para `anon` nem para `authenticated`, de propósito: saber
-- quem está de olho em vaga de motorista é a mesma classe de informação que
-- o currículo, e as chaves de push permitem mandar notificação em nome da
-- Lupa para aquele aparelho. Só a chave de serviço alcança.
--
-- Tudo aqui é aditivo e repetível: rodar duas vezes não muda o resultado.
-- =============================================================================

begin;

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
create table if not exists preferencias_notificacao (
  usuario_id  uuid primary key references usuarios(id) on delete cascade,
  cidade      text not null,
  categoria   text,
  criado_em   timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- O disparo pergunta "quem quer saber de vaga nesta cidade?" a cada vaga
-- publicada; sem índice isso varre a tabela inteira.
create index if not exists preferencias_notificacao_cidade_idx
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
create table if not exists inscricoes_push (
  id          uuid primary key default gen_random_uuid(),
  usuario_id  uuid not null references usuarios(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  criado_em   timestamptz not null default now()
);

create index if not exists inscricoes_push_usuario_idx on inscricoes_push (usuario_id);

alter table preferencias_notificacao enable row level security;
alter table inscricoes_push enable row level security;

-- O Supabase concede `select` a `anon` e `authenticated` por padrão nas
-- tabelas do schema público. A RLS já barra (nenhuma policy = nega tudo),
-- mas o `revoke` é a segunda camada: policy criada por engano, ou um
-- `disable row level security` esquecido depois de depurar, abriria a
-- tabela inteira.
revoke select on preferencias_notificacao from anon, authenticated;
revoke select on inscricoes_push          from anon, authenticated;

commit;

-- Confirme: as três colunas devem vir `true`.
select
  (to_regclass('public.preferencias_notificacao') is not null) as preferencias_ok,
  (to_regclass('public.inscricoes_push') is not null)          as inscricoes_ok,
  not has_table_privilege('anon', 'inscricoes_push', 'SELECT')  as anon_nao_le;
