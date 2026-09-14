import "server-only";

import { createClient as criarClienteSupabase } from "@supabase/supabase-js";
import {
  isSupabaseConfigured,
  SUPABASE_ANON_KEY,
  SUPABASE_URL,
} from "./config";

/**
 * Cliente anônimo **sem cookie**, para leitura que pode ser cacheada (#206).
 *
 * O `createClient` de `./server.ts` chama `cookies()`, que é dado de
 * requisição — e dado de requisição não existe dentro de um cache. Chamar
 * aquele cliente ali não é uma ineficiência: é erro em tempo de execução.
 *
 * **E os cookies nunca fizeram diferença nestas consultas.** A Lupa não usa
 * Supabase Auth: a sessão é um JWT nosso (`lupa_sessao`), e a chave anônima
 * alcança `job_listings` e `provider_listings` por `grant select ... to
 * anon`, não por sessão de ninguém. O cliente com cookie está lá por ser o
 * padrão do `@supabase/ssr`, e o que ele carrega é irrelevante para o
 * resultado destas views.
 *
 * Isso é o que torna o cache **seguro**, e não só possível: se a resposta
 * dependesse de quem pergunta, guardá-la para servir a outra pessoa seria
 * vazamento. Ela não depende — o que depende de quem pergunta é a
 * **ordenação por proximidade**, que acontece depois, em memória, e
 * continua por requisição.
 *
 * Por isso este cliente é deliberadamente burro: sem cookie, sem sessão,
 * sem persistência. Se um dia alguma consulta precisar saber quem está
 * perguntando, ela **não** pode usar este cliente — e o nome está aqui para
 * lembrar disso.
 */
export function clientePublico() {
  if (!isSupabaseConfigured) return null;

  return criarClienteSupabase(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      // Não há sessão para guardar nem renovar: quem autentica é o JWT da
      // Lupa, e este cliente só lê o que é público.
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
