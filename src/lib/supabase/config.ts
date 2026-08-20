/**
 * Enquanto as variáveis do Supabase não estiverem no ambiente, o app roda
 * com os dados de demonstração de Sinop (src/lib/mock-data.ts). Isso permite
 * abrir e mostrar o produto antes de qualquer infraestrutura existir.
 */

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
