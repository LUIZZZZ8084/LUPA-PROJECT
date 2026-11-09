import { resolveContact } from "@/lib/demo";

/**
 * Monta a mensagem e resolve para quem o contato vai.
 *
 * Em demonstração o destino é o número do fundador, não o do prestador
 * fictício — ver src/lib/demo.ts para o porquê.
 */
export function buildContact(
  providerPhone: string,
  providerName: string,
  context?: string,
) {
  const { phone, redirected } = resolveContact(providerPhone);
  const firstName = providerName.split(" ")[0];

  const message = redirected
    ? `Olá! Vim pela demonstração da Lupa e cliquei no perfil de ${providerName}` +
      `${context ? ` (${context})` : ""}.`
    : `Olá, ${firstName}! Vi seu perfil${context ? ` de ${context}` : ""} na Lupa ` +
      `e gostaria de um orçamento.`;

  return { phone, message };
}
