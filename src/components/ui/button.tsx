import { cva, type VariantProps } from "class-variance-authority";
import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const button = cva(
  "inline-flex items-center justify-center gap-2 rounded-xl font-semibold " +
    "transition-[background-color,border-color,color,transform,opacity] duration-150 " +
    "active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 " +
    "whitespace-nowrap select-none",
  {
    variants: {
      variant: {
        /** Ação principal de vagas/emprego. */
        vagas: "bg-vagas text-bg hover:bg-vagas/90",
        /** Ação principal de serviços. */
        servicos: "bg-servicos text-bg hover:bg-servicos/90",
        /** Ação principal de empresas. */
        empresas: "bg-empresas text-bg hover:bg-empresas/90",
        whatsapp: "bg-whatsapp text-[#062a12] hover:bg-whatsapp/90",
        outline:
          "border border-line bg-transparent text-ink hover:bg-panel-2 hover:border-panel-3",
        ghost: "bg-transparent text-muted hover:bg-panel-2 hover:text-ink",
        danger: "bg-danger/15 text-danger hover:bg-danger/25",
      },
      size: {
        sm: "h-9 px-3.5 text-[13px]",
        md: "h-11 px-5 text-sm",
        lg: "h-13 px-6 text-[15px]",
        icon: "h-10 w-10",
      },
      block: {
        true: "w-full",
      },
    },
    defaultVariants: { variant: "vagas", size: "md" },
  },
);

type ButtonVariants = VariantProps<typeof button>;

export function Button({
  className,
  variant,
  size,
  block,
  ...props
}: ComponentProps<"button"> & ButtonVariants) {
  return (
    <button
      className={cn(button({ variant, size, block }), className)}
      {...props}
    />
  );
}

export function ButtonLink({
  className,
  variant,
  size,
  block,
  ...props
}: ComponentProps<typeof Link> & ButtonVariants) {
  return (
    <Link
      className={cn(button({ variant, size, block }), className)}
      {...props}
    />
  );
}

/** Para links externos (WhatsApp, currículo em PDF). */
export function ButtonAnchor({
  className,
  variant,
  size,
  block,
  ...props
}: ComponentProps<"a"> & ButtonVariants) {
  return (
    <a className={cn(button({ variant, size, block }), className)} {...props} />
  );
}

export { button as buttonVariants };
