import { whatsappLink } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ButtonAnchor } from "./ui/button";

function WhatsAppIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      className="flex-none"
    >
      <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.65-2.05-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.5h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.01-1.04 2.47s1.06 2.86 1.21 3.06c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.75-.72 2-1.41.25-.69.25-1.28.17-1.4-.07-.13-.27-.2-.57-.35z" />
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.87 9.87 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2zm0 18.13h-.01a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3.11.82.83-3.04-.2-.31a8.19 8.19 0 0 1-1.26-4.36c0-4.54 3.7-8.24 8.24-8.24a8.18 8.18 0 0 1 5.82 2.42 8.18 8.18 0 0 1 2.41 5.83c0 4.54-3.7 8.24-8.24 8.24z" />
    </svg>
  );
}

/**
 * Contato direto via wa.me. No V0 não existe chat interno: a conversa
 * acontece no WhatsApp, que é onde o público de Sinop já está.
 * A mensagem vai pré-preenchida para o prestador saber de onde veio o lead.
 */
export function WhatsAppButton({
  phone,
  providerName,
  context,
  size = "md",
  block,
  label = "Conversar no WhatsApp",
  className,
}: {
  phone: string;
  providerName: string;
  /** O que a pessoa estava vendo, ex.: "Eletricista". */
  context?: string;
  size?: "sm" | "md" | "lg";
  block?: boolean;
  label?: string;
  className?: string;
}) {
  const message = context
    ? `Olá, ${providerName.split(" ")[0]}! Vi seu perfil de ${context} na Lupa e gostaria de um orçamento.`
    : `Olá, ${providerName.split(" ")[0]}! Vi seu perfil na Lupa e gostaria de um orçamento.`;

  return (
    <ButtonAnchor
      href={whatsappLink(phone, message)}
      target="_blank"
      rel="noopener noreferrer"
      variant="whatsapp"
      size={size}
      block={block}
      className={className}
    >
      <WhatsAppIcon size={size === "sm" ? 15 : 18} />
      {label}
    </ButtonAnchor>
  );
}

/** Versão só ícone, para o canto dos cards de busca. */
export function WhatsAppIconButton({
  phone,
  providerName,
  context,
  className,
}: {
  phone: string;
  providerName: string;
  context?: string;
  className?: string;
}) {
  const message = context
    ? `Olá, ${providerName.split(" ")[0]}! Vi seu perfil de ${context} na Lupa e gostaria de um orçamento.`
    : `Olá, ${providerName.split(" ")[0]}! Vi seu perfil na Lupa e gostaria de um orçamento.`;

  return (
    <a
      href={whatsappLink(phone, message)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Conversar com ${providerName} no WhatsApp`}
      className={cn(
        "flex h-10 w-10 flex-none items-center justify-center rounded-full",
        "bg-whatsapp/15 text-whatsapp transition-colors hover:bg-whatsapp/25",
        className,
      )}
    >
      <WhatsAppIcon size={18} />
    </a>
  );
}

export { WhatsAppIcon };
