-- ============================================================================
-- Cidade com estado: "Sinop" vira "Sinop - MT" (#301)
--
-- O app passou a aceitar qualquer município do Brasil, e 232 nomes de
-- município se repetem entre estados — "Bom Jesus" existe em cinco. O nome
-- sozinho deixou de identificar a cidade, então ela passa a ser gravada com
-- a sigla do estado, no mesmo formato que a tela já mostrava.
--
-- Até aqui o app só aceitava Mato Grosso (`zCidade` validava contra a lista
-- dos 142 municípios de MT), então todo valor sem estado é de MT.
--
-- Aditivo e repetível: o `where` só pega valor ainda sem " - UF" no fim, e
-- rodar duas vezes não acrescenta o estado duas vezes.
--
-- Rode ANTES do deploy desta versão: depois dele, a validação recusa
-- "Sinop" sem estado, e quem já tem conta não conseguiria salvar o perfil.
-- ============================================================================

begin;

update usuarios
   set cidade = cidade || ' - MT'
 where cidade !~ ' - [A-Z]{2}$';

update vagas
   set cidade = cidade || ' - MT'
 where cidade !~ ' - [A-Z]{2}$';

update preferencias_notificacao
   set cidade = cidade || ' - MT'
 where cidade !~ ' - [A-Z]{2}$';

/*
 * Sem padrão de cidade. O padrão era 'Sinop': quem não escolhesse nada
 * virava morador de Sinop sem saber. A aplicação sempre manda a cidade.
 */
alter table usuarios alter column cidade drop default;
alter table vagas alter column cidade drop default;

commit;

-- ─── Conferência: tudo tem de voltar zero ───────────────────────────────
select
  (select count(*) from usuarios where cidade !~ ' - [A-Z]{2}$') as usuarios_sem_estado,
  (select count(*) from vagas where cidade !~ ' - [A-Z]{2}$') as vagas_sem_estado,
  (select count(*) from preferencias_notificacao
     where cidade !~ ' - [A-Z]{2}$') as avisos_sem_estado;
