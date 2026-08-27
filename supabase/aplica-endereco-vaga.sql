-- =============================================================================
-- LUPA — endereço da vaga
--
-- Rode UMA VEZ no banco de produção, no SQL Editor do Supabase. Banco novo
-- não precisa: o `schema.sql` já traz tudo isto.
--
-- PARA QUE SERVE
-- ──────────────
-- Quem se candidata hoje só vê cidade e bairro da vaga — não diz onde é de
-- verdade. Quem depende de ônibus ou de andar precisa saber isso antes de
-- se candidatar, não depois, no contato com a empresa.
--
-- Aditivo ao bairro, não substituto: o ranking de proximidade continua
-- usando só bairro e cidade (`src/lib/proximidade.ts`), porque comparar
-- endereço livre ("Rua X, 123" vs "Rua X 123") não é confiável o bastante
-- para decidir ordem. Endereço é texto solto, só para exibição.
--
-- Coluna opcional no banco — vaga publicada antes deste campo existir
-- continua funcionando sem migração de dado. É a tela de publicação que
-- passa a exigir preenchido em vaga nova.
--
-- Aditivo e repetível.
-- =============================================================================

/*
 * Tudo numa transação só, como em `aplica-habilidades-da-vaga.sql`: o passo
 * do meio derruba `job_listings`, o catálogo de vagas do app inteiro. Se o
 * `create` seguinte falhar, sem transação a view fica destruída e a busca
 * de vagas sai do ar até alguém perceber.
 */
begin;

alter table vagas
  add column if not exists endereco text;

/*
 * A view precisa ser recriada para expor a coluna nova — `create or
 * replace view` recusa mudança na lista de colunas de uma view existente.
 */
drop view if exists job_listings;

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
    'doc_verified', u.doc_verificado
  ) as company,
  (select count(*) from candidaturas c where c.vaga_id = v.id) as applicant_count
from vagas v
join perfis_empresa e on e.usuario_id = v.empresa_id
join usuarios u on u.id = e.usuario_id;

grant select on job_listings to anon, authenticated;

commit;

-- ─── Conferência ────────────────────────────────────────────────────────
-- `coluna_existe` e `anon_le_o_catalogo` devem ser true.

select
  exists (
    select 1 from information_schema.columns
     where table_name = 'vagas' and column_name = 'endereco'
  ) as coluna_existe,
  has_table_privilege('anon', 'job_listings', 'SELECT') as anon_le_o_catalogo;
