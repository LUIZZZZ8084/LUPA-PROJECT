import { BadgeCheck, Phone, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Selo de verificação.
 *
 * É o principal fator de confiança do produto — alguém vai deixar um
 * estranho entrar em casa por causa dele. Por isso aparece no card de busca
 * e no perfil, sempre com o mesmo desenho.
 */
export function VerifiedMark({
  size = 16,
  className,
  title = "Perfil verificado",
}: {
  size?: number;
  className?: string;
  title?: string;
}) {
  return (
    <BadgeCheck
      size={size}
      role="img"
      aria-label={title}
      className={cn("flex-none text-vagas", className)}
    />
  );
}

/** Linha de selos detalhada, usada no perfil do prestador. */
export function VerificationRow({
  phoneVerified,
  docVerified,
  className,
}: {
  phoneVerified: boolean;
  docVerified: boolean;
  className?: string;
}) {
  const items = [
    {
      on: phoneVerified,
      icon: Phone,
      label: "Telefone verificado",
      off: "Telefone não verificado",
    },
    {
      on: docVerified,
      icon: ShieldCheck,
      label: "Documento verificado",
      off: "Documento não verificado",
    },
  ];

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {items.map(({ on, icon: Icon, label, off }) => (
        <span
          key={label}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium",
            on ? "bg-vagas/12 text-vagas" : "bg-panel-3 text-faint",
          )}
        >
          <Icon size={13} />
          {on ? label : off}
        </span>
      ))}
    </div>
  );
}
