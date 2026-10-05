-- ============================================================================
-- LUPA — Storage
--
-- Arquivo à parte porque depende do schema `storage`, que só existe no
-- Supabase. O `schema.sql` roda em qualquer Postgres e é executado por
-- teste contra um de verdade (PGlite); misturar isto lá quebraria essa
-- garantia — e schema que o teste não consegue rodar é schema que ninguém
-- sabe se funciona.
--
-- Rode DEPOIS do `schema.sql`, no mesmo SQL Editor.
-- ============================================================================

-- Limite de tamanho e de tipo no próprio bucket (#332): a segunda camada,
-- para o dia em que um caminho de envio novo esquecer a conferência da
-- aplicação. Os números são os de `src/server/arquivos/regras.ts`, e há
-- teste que compara. Imagem é gravada como WebP desde a #283; JPEG e PNG
-- seguem aceitos. Em banco que já existe, quem aplica é
-- `aplica-limites-dos-buckets.sql`.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('avatares',    'avatares',    true,  2097152, array['image/webp', 'image/jpeg', 'image/png']),
  ('portfolio',   'portfolio',   true,  2097152, array['image/webp', 'image/jpeg', 'image/png']),
  ('curriculos',  'curriculos',  false, 4194304, array['application/pdf']),
  ('verificacao', 'verificacao', false, 4194304, array['image/webp', 'image/jpeg', 'image/png', 'application/pdf'])
on conflict (id) do nothing;

-- Foto de perfil e logo de empresa moram no mesmo bucket, separadas por
-- pasta (`avatar/` e `logo/`). São a mesma coisa do ponto de vista de
-- acesso — imagem pública que aparece na busca — e um bucket a menos é uma
-- policy a menos para manter em dia.
create policy "avatares publicos para leitura"
  on storage.objects for select using (bucket_id = 'avatares');

create policy "portfolio publico para leitura"
  on storage.objects for select using (bucket_id = 'portfolio');

-- Currículo e verificação não recebem policy: com RLS ligada e nenhuma
-- policy, o Postgres nega tudo. O acesso é feito pelo servidor com a chave
-- de serviço, que gera URL assinada de curta duração quando precisa mostrar
-- o arquivo.
--
-- O currículo é privado pela mesma razão do currículo em texto: nem todo
-- mundo quer que o patrão atual descubra que está procurando emprego, e
-- essa informação pode custar o emprego que a pessoa ainda tem.
