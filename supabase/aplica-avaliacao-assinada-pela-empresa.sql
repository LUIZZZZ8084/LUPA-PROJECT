-- ============================================================================
-- A avaliação feita por empresa passa a levar o nome da empresa (#315)
--
-- A conta de empresa tem dois nomes: o do responsável (`usuarios.
-- nome_completo`), que é registro da conta, e o da empresa (`perfis_empresa.
-- razao_social`), que é quem age na plataforma. A avaliação gravava o do
-- responsável. Daqui em diante a aplicação grava o da empresa; este script
-- corrige as que já existem.
--
-- Só toca avaliação com dono cuja conta é de empresa e tem perfil. A de
-- candidato e a de prestador continuam com o nome da pessoa, e a do seed
-- (sem `avaliador_id`) não é tocada.
--
-- Pode rodar a qualquer momento, antes ou depois do deploy, e repetido não
-- muda nada.
-- ============================================================================

begin;

update avaliacoes a
   set nome_avaliador = e.razao_social
  from usuarios u
  join perfis_empresa e on e.usuario_id = u.id
 where a.avaliador_id = u.id
   and u.papel = 'empresa'
   and a.nome_avaliador is distinct from e.razao_social;

commit;

-- ─── Conferência: tem de voltar zero ───────────────────────────────────
select count(*) as avaliacoes_de_empresa_com_outro_nome
  from avaliacoes a
  join usuarios u on u.id = a.avaliador_id
  join perfis_empresa e on e.usuario_id = u.id
 where u.papel = 'empresa'
   and a.nome_avaliador is distinct from e.razao_social;
