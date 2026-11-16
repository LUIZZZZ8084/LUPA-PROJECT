-- ============================================================================
-- Retratos e logos dos perfis de exemplo (#614)
--
-- Os 9 prestadores de exemplo e três empresas trocaram o avatar desenhado
-- (`.svg`) por imagem em `.webp`. Só os perfis de exemplo, que apontam para
-- `/avatares/` do próprio app; foto enviada por gente de verdade mora no
-- Storage e não é tocada.
--
-- **Rode depois do deploy**: antes dele os `.webp` ainda não existem, e o
-- perfil ficaria sem imagem. Seguro de rodar mais de uma vez.
-- ============================================================================

begin;

update usuarios
   set avatar_url = replace(avatar_url, '.svg', '.webp')
 where avatar_url in (
   '/avatares/prv-joao-silva.svg', '/avatares/prv-carlos-souza.svg',
   '/avatares/prv-marcos-lima.svg', '/avatares/prv-jose-moreira.svg',
   '/avatares/prv-ana-paula.svg', '/avatares/prv-rosa-mendes.svg',
   '/avatares/prv-pedro-alves.svg', '/avatares/prv-luciana-costa.svg',
   '/avatares/prv-antonio-ferreira.svg',
   '/avatares/cmp-agro-norte.svg', '/avatares/cmp-comercial-sinop.svg',
   '/avatares/cmp-casa-construcao.svg'
 );

update perfis_empresa
   set logo_url = replace(logo_url, '.svg', '.webp')
 where logo_url in (
   '/avatares/cmp-agro-norte.svg', '/avatares/cmp-comercial-sinop.svg',
   '/avatares/cmp-casa-construcao.svg'
 );

commit;

-- ─── Conferência ────────────────────────────────────────────────────────
-- `sobrou_svg` 0 nas duas linhas.
select 'usuarios' as tabela, count(*) filter (where avatar_url ~ '/avatares/(prv-|cmp-agro|cmp-comercial|cmp-casa).*\.svg') as sobrou_svg
  from usuarios
union all
select 'perfis_empresa', count(*) filter (where logo_url ~ '/avatares/cmp-(agro|comercial|casa).*\.svg')
  from perfis_empresa;
