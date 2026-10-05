-- ============================================================================
-- Limite de tamanho e de tipo nos buckets do Storage (#332)
--
-- Até aqui os quatro buckets aceitavam qualquer arquivo, de qualquer
-- tamanho: só a aplicação conferia. É a segunda camada que faltava, a mesma
-- lógica do `revoke` em cima da RLS — o dia em que alguém escrever um
-- caminho de envio novo e esquecer a conferência, o Storage recusa sozinho.
--
-- Os números são os de `src/server/arquivos/regras.ts`, e o
-- `storage.sql` diz o mesmo para banco novo. Há teste que compara os três.
--
-- **Imagem é gravada como WebP** (#283): o servidor reduz toda foto antes
-- de gravar. JPEG e PNG continuam aceitos para não recusar nada que já
-- funcione hoje.
--
-- Pode rodar mais de uma vez: é `update`, e o resultado é o mesmo.
--
-- Depois de rodar, vale trocar a foto de um perfil e enviar um currículo,
-- para ver que o envio continua funcionando.
-- ============================================================================

update storage.buckets
set file_size_limit = 2097152,
    allowed_mime_types = array['image/webp', 'image/jpeg', 'image/png']
where id in ('avatares', 'portfolio');

update storage.buckets
set file_size_limit = 4194304,
    allowed_mime_types = array['application/pdf']
where id = 'curriculos';

-- Documento e selfie: sem tela de envio desde a #133, mas o bucket existe.
update storage.buckets
set file_size_limit = 4194304,
    allowed_mime_types = array['image/webp', 'image/jpeg', 'image/png', 'application/pdf']
where id = 'verificacao';

-- Confere: os quatro devem aparecer com limite e tipos preenchidos.
select id, file_size_limit, allowed_mime_types from storage.buckets order by id;
