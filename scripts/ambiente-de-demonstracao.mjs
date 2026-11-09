/**
 * As variáveis que um processo de demonstração precisa zerar (#584).
 *
 * O e2e e o `dev:demo` sobem o app com o `.env.local` carregado, e quem tem
 * credenciais reais ali passaria a usá-las sem perceber. Zerar só o
 * Supabase não bastava: o app decide por provedor se fala com o serviço de
 * verdade — Mercado Pago, Resend, push —, independente do modo de
 * demonstração. Variável vazia no ambiente vence o arquivo.
 *
 * Uma lista só, usada pelos dois, para que provedor novo entre nos dois
 * lugares de uma vez. `tests/unit/ambiente-de-demonstracao.test.ts` confere
 * que todo provedor do `.env.example` está aqui.
 */
export const VARIAVEIS_DE_PROVEDOR = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "MERCADO_PAGO_ACCESS_TOKEN",
  "MERCADO_PAGO_WEBHOOK_SECRET",
  "RESEND_API_KEY",
  "EMAIL_REMETENTE",
  "NEXT_PUBLIC_VAPID_PUBLIC_KEY",
  "VAPID_PRIVATE_KEY",
  "VAPID_SUBJECT",
  "CRON_SECRET",
  "NEXT_PUBLIC_SENTRY_DSN",
  "SENTRY_ORG",
  "SENTRY_PROJECT",
  "SENTRY_AUTH_TOKEN",
];

/** O objeto de ambiente com todas elas vazias. */
export function provedoresDesligados() {
  return Object.fromEntries(VARIAVEIS_DE_PROVEDOR.map((nome) => [nome, ""]));
}
