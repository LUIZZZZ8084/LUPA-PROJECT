"use client";

import type { ComponentProps, ReactElement, ReactNode } from "react";
import { cloneElement, isValidElement, useId } from "react";
import { cn } from "@/lib/utils";

const control =
  "w-full rounded-xl border border-line bg-panel-2 px-3.5 text-sm text-ink " +
  "placeholder:text-faint transition-colors duration-[var(--duration-fast)] " +
  "hover:border-panel-3 focus:border-vagas focus:outline-none " +
  "disabled:opacity-50";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(control, "h-11", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        control,
        "min-h-28 resize-y py-3 leading-relaxed",
        className,
      )}
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

/**
 * Rótulo, dica e erro de um campo de formulário.
 *
 * A associação é explícita, por `id` e `htmlFor`, em vez de embrulhar o
 * campo no <label>. Assim dá para ligar dica e mensagem de erro ao campo
 * via aria-describedby: o leitor de tela anuncia "WhatsApp, é por onde as
 * pessoas vão falar com você" em vez de só "WhatsApp". Quem depende de
 * leitor de tela não tem como ver o texto cinza embaixo do campo.
 */
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
  const id = useId();
  const idDica = `${id}-dica`;
  const idErro = `${id}-erro`;

  const descrito =
    [error ? idErro : null, hint && !error ? idDica : null]
      .filter(Boolean)
      .join(" ") || undefined;

  // Repassa id, estado de erro e descrição ao campo sem exigir que cada
  // chamada os declare.
  const campo = isValidElement(children)
    ? cloneElement(children as ReactElement<Record<string, unknown>>, {
        id,
        "aria-describedby": descrito,
        "aria-invalid": error ? true : undefined,
        "aria-required": required || undefined,
      })
    : children;

  return (
    <div className={cn("block", className)}>
      <label
        htmlFor={id}
        className="mb-1.5 flex items-center gap-1 text-[13px] font-medium text-ink"
      >
        {label}
        {required && (
          <span aria-hidden className="text-danger">
            *
          </span>
        )}
      </label>

      {campo}

      {hint && !error && (
        <span id={idDica} className="mt-1.5 block text-xs text-faint">
          {hint}
        </span>
      )}
      {error && (
        <span
          id={idErro}
          role="alert"
          className="mt-1.5 block text-xs text-danger"
        >
          {error}
        </span>
      )}
    </div>
  );
}
