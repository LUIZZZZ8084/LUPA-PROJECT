import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

const control =
  "w-full rounded-xl border border-line bg-panel-2 px-3.5 text-sm text-ink " +
  "placeholder:text-faint transition-colors " +
  "hover:border-panel-3 focus:border-vagas focus:outline-none " +
  "disabled:opacity-50";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(control, "h-11", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(control, "min-h-28 resize-y py-3 leading-relaxed", className)}
      {...props}
    />
  );
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return (
    <select
      className={cn(
        control,
        "h-11 appearance-none pr-9",
        // Seta desenhada em CSS para não depender de ícone extra.
        "bg-[image:linear-gradient(45deg,transparent_50%,var(--color-muted)_50%),linear-gradient(135deg,var(--color-muted)_50%,transparent_50%)]",
        "bg-[position:calc(100%-18px)_calc(50%+2px),calc(100%-13px)_calc(50%+2px)]",
        "bg-[size:5px_5px,5px_5px] bg-no-repeat",
        className,
      )}
      {...props}
    />
  );
}

export function Field({
  label,
  hint,
  error,
  required,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 flex items-center gap-1 text-[13px] font-medium text-ink">
        {label}
        {required && (
          <span className="text-danger" aria-label="obrigatório">
            *
          </span>
        )}
      </span>
      {children}
      {hint && !error && (
        <span className="mt-1.5 block text-xs text-faint">{hint}</span>
      )}
      {error && (
        <span className="mt-1.5 block text-xs text-danger">{error}</span>
      )}
    </label>
  );
}
