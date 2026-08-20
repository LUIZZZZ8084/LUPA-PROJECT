import { cn } from "@/lib/utils";

/**
 * Esqueletos de carregamento.
 *
 * Cada um imita a forma do conteúdo que vai substituir. Isso não é
 * capricho: se o esqueleto tem altura diferente do conteúdo real, a tela
 * "pula" quando os dados chegam — e num celular lento a pessoa já clicou
 * onde o botão estava um instante antes.
 */

export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("skeleton", className)} {...props} />;
}

/** Linha de texto. `w` aceita qualquer classe de largura do Tailwind. */
export function SkeletonText({
  w = "w-full",
  className,
}: {
  w?: string;
  className?: string;
}) {
  return <Skeleton className={cn("h-3.5", w, className)} />;
}

export function SkeletonAvatar({
  size = "md",
  square = false,
}: {
  size?: "sm" | "md" | "lg" | "xl";
  square?: boolean;
}) {
  const sizes = {
    sm: "h-9 w-9",
    md: "h-12 w-12",
    lg: "h-16 w-16",
    xl: "h-24 w-24",
  };
  return (
    <Skeleton
      className={cn(sizes[size], square ? "rounded-xl" : "rounded-full")}
    />
  );
}

/* ============================================================
   Esqueletos específicos — espelham os componentes reais
   ============================================================ */

/** Espelha JobCard. */
export function JobCardSkeleton() {
  return (
    <div className="flex gap-3.5 rounded-[var(--radius-card)] border border-line bg-panel p-4">
      <SkeletonAvatar square />
      <div className="min-w-0 flex-1 space-y-2">
        <SkeletonText w="w-3/4" className="h-4" />
        <SkeletonText w="w-2/5" className="h-3" />
        <SkeletonText w="w-1/2" className="mt-3 h-3.5" />
        <div className="flex gap-3 pt-1">
          <SkeletonText w="w-24" className="h-2.5" />
          <SkeletonText w="w-12" className="h-2.5" />
        </div>
      </div>
    </div>
  );
}

/** Espelha ProviderCard. */
export function ProviderCardSkeleton() {
  return (
    <div className="flex gap-3.5 rounded-[var(--radius-card)] border border-line bg-panel p-4">
      <SkeletonAvatar />
      <div className="min-w-0 flex-1 space-y-2">
        <SkeletonText w="w-2/5" className="h-4" />
        <SkeletonText w="w-1/4" className="h-3" />
        <div className="flex gap-3 pt-1">
          <SkeletonText w="w-16" className="h-3" />
          <SkeletonText w="w-28" className="h-3" />
        </div>
        <SkeletonText w="w-3/5" className="h-2.5" />
      </div>
      <Skeleton className="h-10 w-10 flex-none self-center rounded-full" />
    </div>
  );
}

/** Espelha FilterBar: campo de busca mais a faixa de chips. */
export function FilterBarSkeleton() {
  return (
    <div className="mb-5 space-y-3">
      <Skeleton className="h-12 rounded-xl" />
      <div className="flex gap-2">
        <Skeleton className="h-9 w-28 rounded-full" />
        <Skeleton className="h-9 w-24 rounded-full" />
        <Skeleton className="h-9 w-20 rounded-full" />
      </div>
    </div>
  );
}

/** Espelha PageTitle. */
export function PageTitleSkeleton({
  withAction = false,
}: {
  withAction?: boolean;
}) {
  return (
    <div className="mb-6 flex items-end justify-between gap-3">
      <div className="space-y-2.5">
        <Skeleton className="h-7 w-40" />
        <SkeletonText w="w-72" className="h-3.5" />
      </div>
      {withAction && <Skeleton className="h-11 w-44 rounded-xl" />}
    </div>
  );
}

/** Grade de cards, com a mesma contagem típica da lista real. */
export function CardGridSkeleton({
  count = 6,
  variant = "job",
}: {
  count?: number;
  variant?: "job" | "provider";
}) {
  const Card = variant === "job" ? JobCardSkeleton : ProviderCardSkeleton;
  return (
    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
      {Array.from({ length: count }, (_, i) => (
        <Card key={i} />
      ))}
    </div>
  );
}

/** Espelha os blocos de estatística do painel da empresa. */
export function StatsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="rounded-xl border border-line bg-panel-2 px-3 py-4"
        >
          <Skeleton className="mx-auto h-7 w-12" />
          <Skeleton className="mx-auto mt-2 h-2.5 w-16" />
        </div>
      ))}
    </div>
  );
}

/** Linhas de lista dentro de um painel. */
export function ListRowsSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-panel">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 p-4">
          <SkeletonAvatar size="sm" />
          <div className="flex-1 space-y-2">
            <SkeletonText w="w-2/5" />
            <SkeletonText w="w-1/3" className="h-2.5" />
          </div>
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      ))}
    </div>
  );
}
