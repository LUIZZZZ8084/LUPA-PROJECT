import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import {
  isSupabaseConfigured,
  SUPABASE_ANON_KEY,
  SUPABASE_URL,
} from "./config";

/**
 * Cliente Supabase para Server Components, Route Handlers e Server Actions.
 * Retorna null no modo demonstração (sem variáveis de ambiente).
 */
export async function createClient() {
  if (!isSupabaseConfigured) return null;

  const cookieStore = await cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Component não pode escrever cookie; o middleware cuida
          // da renovação da sessão, então ignorar aqui é seguro.
        }
      },
    },
  });
}
