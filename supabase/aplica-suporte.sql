-- ============================================================================
-- Canal de suporte por formulario (#235)
--
-- O publico deste app abre e-mail no celular, e boa parte nao tem cliente de
-- e-mail configurado. Mandar a pessoa "escrever para contato@" e mandar
-- metade dela desistir — e quem procura o suporte de uma plataforma de
-- emprego costuma estar com um problema que nao pode esperar.
--
-- ## A linha e apagada junto com a conta
--
-- `on delete cascade`, e nao `set null`. A mensagem carrega nome, e-mail e
-- texto livre que a propria pessoa escreveu sobre a situacao dela; guardar
-- isso depois de ela pedir exclusao contradiria a Politica de Privacidade,
-- que promete apagar o que identifica.
--
-- ## `usuario_id` e nulavel de proposito
--
-- Quem nao consegue entrar e exatamente quem mais precisa do suporte. A
-- pagina e aberta, e o formulario funciona sem sessao.
--
-- ## `respondida_em` guarda o estado, nunca a resposta
--
-- A resposta sai por e-mail. Copiar o texto para ca seria guardar a conversa
-- inteira sem necessidade — mais dado pessoal, pela conveniencia de um
-- historico que ninguem pediu.
--
-- Idempotente.
-- ============================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'assunto_suporte') then
    create type assunto_suporte as enum (
      'conta', 'pagamento', 'anuncio', 'privacidade', 'outro'
    );
  end if;
end $$;

create table if not exists mensagens_suporte (
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

create index if not exists mensagens_suporte_abertas_idx
  on mensagens_suporte (criado_em desc)
  where respondida_em is null;

alter table mensagens_suporte enable row level security;
revoke select on mensagens_suporte from anon, authenticated;

do $$
begin
  if has_table_privilege('anon', 'mensagens_suporte', 'SELECT')
     or has_table_privilege('authenticated', 'mensagens_suporte', 'SELECT')
  then
    raise exception 'mensagens_suporte ficou legivel por anon/authenticated';
  end if;
end $$;
