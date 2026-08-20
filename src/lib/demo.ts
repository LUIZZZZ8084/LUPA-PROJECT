import { isSupabaseConfigured } from "./supabase/config";

/**
 * Modo demonstração: o app roda com os dados de exemplo de Sinop, sem banco.
 */
export const isDemoMode = !isSupabaseConfigured;

/**
 * Telefone que recebe os contatos durante a demonstração.
 *
 * Os prestadores de exemplo têm telefones fictícios, mas plausíveis — abrir
 * `wa.me` com eles mandaria mensagem de desconhecidos para quem realmente
 * tiver aquele número. Então, em demonstração, todo contato é redirecionado
 * para este número (o do fundador), que ainda serve de termômetro: mostra
 * quais categorias as pessoas procuram.
 *
 * Sem esta variável definida, o botão de contato fica desativado.
 */
export const DEMO_CONTACT_PHONE =
  process.env.NEXT_PUBLIC_LUPA_DEMO_WHATSAPP?.trim() || null;

/**
 * Para quem o contato deve ir de fato, e como a mensagem deve ser montada.
 * Em produção é o próprio prestador; em demonstração, o número do fundador.
 */
export function resolveContact(providerPhone: string): {
  phone: string | null;
  redirected: boolean;
} {
  if (!isDemoMode) return { phone: providerPhone, redirected: false };
  return { phone: DEMO_CONTACT_PHONE, redirected: true };
}
