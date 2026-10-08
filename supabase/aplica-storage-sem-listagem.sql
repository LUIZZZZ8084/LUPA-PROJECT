-- ============================================================================
-- Os buckets públicos deixam de ser listáveis (#396)
--
-- `avatares` e `portfolio` tinham policy de `select` em `storage.objects`.
-- Servir a URL pública de um bucket público não depende dela: o Storage
-- entrega o arquivo de bucket público sem consultar policy. O que ela
-- liberava era listar o bucket inteiro pela API, com a chave anônima que
-- vai para o navegador — e o caminho de cada arquivo começa pelo id da
-- conta, então a listagem entregava o id de todo mundo que tem foto.
--
-- O app não lista nada. Enviar, trocar e apagar passam pelo servidor, com a
-- chave de serviço, que não depende de policy.
--
-- Pode rodar antes ou depois do deploy, e rodar de novo não muda nada.
-- Depois de rodar, uma foto de perfil qualquer do app tem de continuar
-- aparecendo — é a prova de que a URL pública não dependia da policy.
-- ============================================================================

drop policy if exists "avatares publicos para leitura" on storage.objects;
drop policy if exists "portfolio publico para leitura" on storage.objects;

-- ─── Conferência: tem de voltar zero ───────────────────────────────────
select count(*) as policies_de_listagem
  from pg_policies
 where schemaname = 'storage'
   and tablename = 'objects'
   and policyname in (
     'avatares publicos para leitura',
     'portfolio publico para leitura'
   );
