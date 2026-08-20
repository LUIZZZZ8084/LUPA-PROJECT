import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const badge = cva(
  "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap",
  {
    variants: {
      tone: {
        vagas: "bg-vagas/15 text-vagas",
        servicos: "bg-servicos/15 text-servicos",
        empresas: "bg-empresas/15 text-empresas",
        warn: "bg-warn/15 text-warn",
        danger: "bg-danger/15 text-danger",
        neutral: "bg-panel-3 text-muted",
        outline: "border border-line text-muted",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export function Badge({
  className,
  tone,
  ...props
}: ComponentProps<"span"> & VariantProps<typeof badge>) {
  return <span className={cn(badge({ tone }), className)} {...props} />;
}

/** Chip de metadado: ícone + texto, sem fundo. Usado nos cards. */
export function Meta({
  icon,
  children,
  className,
}: {
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs text-muted",
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}
