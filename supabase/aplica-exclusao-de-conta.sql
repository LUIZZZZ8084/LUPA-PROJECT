-- ============================================================================
-- Excluir a propria conta (#423)
--
-- LGPD, art. 18, VI. A funcao que a aplicacao chama quando alguem exclui a
-- conta pelo perfil. Tudo numa transacao so: perfis, curriculo,
-- candidaturas, publicacoes, avaliacoes recebidas, avisos, aparelhos,
-- tokens, creditos e pedidos de verificacao saem; nome, e-mail, telefone,
-- CPF e senha da conta sao substituidos; as sessoes sao cortadas.
-- Pagamentos e assinaturas ficam, ligados a conta anonimizada: sao o
-- historico do caixa e nao guardam dado pessoal.
--
-- **Rode antes do deploy.** O botao chama esta funcao; sem ela, excluir a
-- conta falha com erro, sem excluir nada.
--
-- Seguro de rodar mais de uma vez.
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
