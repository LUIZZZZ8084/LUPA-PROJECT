import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Container padrão das páginas: largura máxima, respiro e espaço da bottom nav. */
export function PageShell({
  children,
  className,
  width = "default",
}: {
  children: ReactNode;
  className?: string;
  width?: "default" | "narrow" | "wide";
}) {
  const max = {
    narrow: "max-w-2xl",
    default: "max-w-4xl",
    wide: "max-w-6xl",
  }[width];

  return (
    <main
      className={cn(
        "mx-auto w-full px-4 pt-6 pb-28 sm:px-6 md:pb-16",
        max,
        className,
      )}
    >
      {children}
    </main>
  );
}

/** Link de volta usado no topo das telas de detalhe. */
export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="mb-4 inline-flex items-center gap-1 text-sm text-muted transition-colors hover:text-ink"
    >
      <ChevronLeft size={16} />
      {label}
    </Link>
  );
}

/** Cabeçalho de página com título, descrição e ação opcional. */
export function PageTitle({
  title,
  description,
  accent = "text-ink",
  action,
  back,
}: {
  title: string;
  description?: string;
  accent?: string;
  action?: ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <div className="mb-6">
      {back && (
        <Link
          href={back.href}
          className="mb-3 inline-flex items-center gap-1 text-sm text-muted transition-colors hover:text-ink"
        >
          <ChevronLeft size={16} />
          {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className={cn("text-2xl font-bold tracking-tight", accent)}>
            {title}
          </h1>
          {description && (
            <p className="mt-1.5 text-sm text-muted">{description}</p>
          )}
        </div>
        {action}
      </div>
    </div>
  );
}

/** Estado vazio consistente para buscas sem resultado. */
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-[var(--radius-panel)] border border-dashed border-line bg-panel/40 px-6 py-14 text-center">
      {icon && (
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-panel-2 text-muted">
          {icon}
        </div>
      )}
      <p className="font-semibold text-ink">{title}</p>
      {description && (
        <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
