-- =============================================================================
-- LUPA — "quero que empresas me encontrem"
--
-- Rode UMA VEZ no banco de produção, no SQL Editor do Supabase. Banco novo
-- não precisa: o `schema.sql` já traz tudo isto.
--
-- POR QUE
-- ───────
-- Até agora, a pessoa se expunha a uma empresa no momento em que decidia se
-- candidatar a ela — e não havia como dizer "pode me procurar". Quem queria
-- ser encontrado não tinha como; quem não queria estava protegido por
-- ausência de recurso, não por escolha.
--
-- Isto cria a escolha. **Desligada por padrão**, e o padrão é a parte que
-- importa: numa cidade do tamanho de Sinop, quem está empregado e
-- procurando outra coisa pode ter o patrão atual entre as empresas
-- cadastradas.
--
-- O QUE A EMPRESA PASSA A ALCANÇAR
-- ────────────────────────────────
-- Contato, não currículo. Nome, cidade, bairro, área desejada,
-- disponibilidade, habilidades, e-mail e telefone de quem ligou a opção.
--
-- Currículo e resumo ficam de fora da view de propósito: quem se candidata
-- entrega o currículo junto com a candidatura; quem só está visível
-- entregou contato. São dois consentimentos diferentes, e misturá-los faria
-- "pode me procurar" significar "leia meu histórico inteiro".
--
-- ONDE MORA A FECHADURA
-- ─────────────────────
-- No `where` da view, e não na aplicação. Assim, nenhum esquecimento de
-- filtro numa tela pode revelar alguém que não consentiu — e desligar a
-- opção tira a pessoa da view na mesma consulta.
--
-- Aditivo e repetível. Tudo numa transação: a view é criada e revogada no
-- mesmo passo, e uma metade sem a outra é uma view aberta.
-- =============================================================================

begin;

alter table perfis_candidato
  add column if not exists visivel_para_empresas boolean not null default false;

create or replace view candidatos_disponiveis
with (security_invoker = false) as
select
  u.id,
  u.nome_completo    as full_name,
  u.avatar_url,
  u.cidade           as city,
  u.bairro           as neighborhood,
  u.email,
  u.telefone         as phone,
  pc.area_desejada   as desired_area,
  pc.disponibilidade as availability,
  coalesce(pc.habilidades, '{}'::text[]) as skills
from perfis_candidato pc
join usuarios u on u.id = pc.usuario_id
where pc.visivel_para_empresas
  and u.papel = 'candidato_clt';

revoke select on candidatos_disponiveis from anon, authenticated;

commit;

-- ─── Conferência ────────────────────────────────────────────────────────
-- `padrao_desligado` e `view_existe` devem ser true; `anon_le` false.
-- `visiveis_hoje` mostra quantas pessoas já ligaram a opção — logo depois
-- de rodar isto, o esperado é zero.

select
  (select column_default = 'false'
     from information_schema.columns
    where table_name = 'perfis_candidato'
      and column_name = 'visivel_para_empresas') as padrao_desligado,
  exists (select 1 from information_schema.views
           where table_name = 'candidatos_disponiveis') as view_existe,
  has_table_privilege('anon', 'candidatos_disponiveis', 'SELECT') as anon_le,
  (select count(*) from candidatos_disponiveis) as visiveis_hoje;
