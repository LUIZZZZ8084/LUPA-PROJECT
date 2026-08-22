import { PageShell } from "@/components/layout/page-shell";
import {
  JobCardSkeleton,
  ProviderCardSkeleton,
  Skeleton,
  SkeletonText,
} from "@/components/ui/skeleton";

/** Espelha a home: hero, três verticais e os dois feeds. */
export default function Loading() {
  return (
    <>
      <section className="aurora border-b border-line">
        <div className="mx-auto max-w-4xl px-4 pt-10 pb-12 sm:px-6 sm:pt-16">
          <Skeleton className="h-6 w-44 rounded-full" />
          <Skeleton className="mt-5 h-10 w-4/5 sm:h-14" />
          <Skeleton className="mt-2 h-10 w-3/5 sm:h-14" />
          <div className="mt-4 space-y-2">
            <SkeletonText w="w-full max-w-xl" />
            <SkeletonText w="w-2/3 max-w-md" />
          </div>
          <div className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton
                key={i}
                className="h-[74px] rounded-[var(--radius-card)]"
              />
            ))}
          </div>
        </div>
      </section>

      <PageShell>
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          <section>
            <Skeleton className="mb-3 h-5 w-40" />
            <div className="space-y-2.5">
              {Array.from({ length: 4 }, (_, i) => (
                <JobCardSkeleton key={i} />
              ))}
            </div>
          </section>
          <section>
            <Skeleton className="mb-3 h-5 w-52" />
            <div className="space-y-2.5">
              {Array.from({ length: 4 }, (_, i) => (
                <ProviderCardSkeleton key={i} />
              ))}
            </div>
          </section>
        </div>
      </PageShell>
    </>
  );
}
