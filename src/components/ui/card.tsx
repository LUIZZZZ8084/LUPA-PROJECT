import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-card)] border border-line bg-panel",
        className,
      )}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: ComponentProps<"h3">) {
  return (
    <h3
      className={cn("text-base leading-tight font-semibold", className)}
      {...props}
    />
  );
}

export function CardBody({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("p-5 pt-0", className)} {...props} />;
}

/** Painel maior usado como seção de página. */
export function Panel({ className, ...props }: ComponentProps<"section">) {
  return (
    <section
      className={cn(
        "rounded-[var(--radius-panel)] border border-line bg-panel p-5 sm:p-6",
        className,
      )}
      {...props}
    />
  );
}

/** Bloco de estatística do painel Minha Empresa. */
export function Stat({
  label,
  value,
  accent = "text-ink",
}: {
  label: string;
  value: string | number;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-line bg-panel-2 px-3 py-4 text-center">
      <div className={cn("text-2xl font-bold tabular-nums", accent)}>
        {value}
      </div>
      <div className="mt-1 text-[11px] text-muted">{label}</div>
    </div>
  );
}
