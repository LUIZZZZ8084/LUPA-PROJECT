-- ============================================================================
-- Vaga removida pela moderação (#577)
--
-- A moderação tirava a vaga do ar deixando-a só "fechada", o mesmo estado de
-- quando a empresa encerra. Agora a remoção fica marcada em
-- `vagas.removida_em`, a view a expõe no fim, e `decidir_denuncia` grava a
-- marca. O app deixa de abrir a vaga marcada pelo link público.
--
-- **Rode antes do deploy**: o app lê `removed_at` da view. Seguro de rodar
-- mais de uma vez.
-- ============================================================================

begin;

alter table vagas add column if not exists removida_em timestamptz;

create or replace view job_listings
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
  v.perguntas                 as screening_questions,
  -- E o cliente em sigilo da agência (#538), pela mesma regra.
  v.contratante_confidencial  as hiring_for,
  -- E a remoção pela moderação (#577), pela mesma regra: coluna nova no fim.
  v.removida_em               as removed_at
from vagas v
join perfis_empresa e on e.usuario_id = v.empresa_id
join usuarios u on u.id = e.usuario_id;

grant select on job_listings to anon, authenticated;

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
      -- Removida pela moderação, e não só encerrada (#577): o link público
      -- deixa de abrir, e o painel da dona diz o que houve.
      update vagas set status = 'fechada', removida_em = now()
       where id = p_alvo_id;
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

-- Função recriada: a execução continua só da chave de serviço (#449).
revoke execute on function decidir_denuncia(alvo_denuncia, uuid, boolean)
  from public, anon, authenticated;
grant execute on function decidir_denuncia(alvo_denuncia, uuid, boolean) to service_role;

commit;

select
  exists (select 1 from information_schema.columns
    where table_name = 'vagas' and column_name = 'removida_em') as coluna_existe,
  exists (select 1 from information_schema.columns
    where table_name = 'job_listings' and column_name = 'removed_at') as view_expoe;
