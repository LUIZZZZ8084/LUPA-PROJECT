-- ============================================================================
-- Verificacao de e-mail (#227)
--
-- A migracao `0001` trocou o Supabase Auth por autenticacao propria, e o
-- AGENTS.md registra desde entao o que se perdeu junto: verificacao de
-- e-mail e recuperacao de senha. A segunda foi construida na #174; esta e a
-- primeira.
--
-- E fecha um caso de estado declarado sem produtor: `usuarios.
-- email_verificado` existe desde o comeco, e lido pelos repositorios, e
-- **nada nunca escreveu nele**.
--
-- ## O dano, medido antes de dimensionar
--
-- Nao e spam: o unico e-mail que a Lupa manda e o de recuperacao de senha,
-- e ele so sai quando alguem digita aquele endereco em "esqueci minha
-- senha". Nao e tomar conta alheia: o dono de verdade retoma pela
-- recuperacao, que cai na caixa dele.
--
-- **E o erro de digitacao.** Quem erra o proprio e-mail no cadastro fica
-- com uma conta que nao tem como ser recuperada, e descobre isso no dia em
-- que esquecer a senha — quando nao ha suporte possivel, porque nao existe
-- como provar que a conta e dele.
--
-- ## Por que reaproveitar a tabela de tokens
--
-- Verificacao de e-mail usa exatamente o mesmo material que a recuperacao:
-- segredo aleatorio, guardado em hash, de uso unico, com prazo. Uma tabela
-- gemea divergiria na primeira vez que alguem mexesse num lado so.
--
-- **O que ela nao pode ser e um token que serve para as duas coisas.** O de
-- verificacao sai com muito mais liberdade — no cadastro e a cada
-- "reenviar" —, e se ele tambem trocasse senha, cada reenvio seria mais um
-- link de redefinicao circulando. Por isso `finalidade` entra na instrucao
-- que **consome** o token, junto do hash, e nao numa checagem antes: duas
-- requisicoes simultaneas atravessariam a checagem.
--
-- O default e 'recuperacao', entao as linhas que ja existem continuam
-- valendo para o que sempre foram.
--
-- Idempotente.
-- ============================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'finalidade_token') then
    create type finalidade_token as enum ('recuperacao', 'verificacao_email');
  end if;
end $$;

alter table tokens_recuperacao
  add column if not exists finalidade finalidade_token not null
    default 'recuperacao';

do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'tokens_recuperacao'
       and column_name = 'finalidade'
  ) then
    raise exception 'coluna finalidade nao foi criada';
  end if;

  if has_table_privilege('anon', 'tokens_recuperacao', 'SELECT') then
    raise exception 'tokens_recuperacao ficou legivel por anon';
  end if;
end $$;
