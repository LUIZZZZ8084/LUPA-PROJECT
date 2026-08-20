import { PageShell } from "@/components/layout/page-shell";
import { Panel } from "@/components/ui/card";
import {
  PageTitleSkeleton,
  Skeleton,
  SkeletonAvatar,
  SkeletonText,
} from "@/components/ui/skeleton";

/** Espelha a fila de verificações. */
export default function Loading() {
  return (
    <PageShell width="narrow">
      <PageTitleSkeleton />

      <Panel className="mb-5 space-y-2">
        <SkeletonText />
        <SkeletonText w="w-4/5" />
      </Panel>

      <div className="space-y-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div
            key={i}
            className="rounded-[var(--radius-card)] border border-line bg-panel p-4"
          >
            <div className="flex items-start gap-3.5">
              <SkeletonAvatar />
              <div className="flex-1 space-y-2">
                <SkeletonText w="w-36" className="h-3.5" />
                <SkeletonText w="w-48" className="h-2.5" />
                <SkeletonText w="w-40" className="h-2.5" />
              </div>
              <Skeleton className="h-6 w-24 rounded-full" />
            </div>
            <div className="mt-4 flex gap-2">
              <Skeleton className="h-9 w-32 rounded-xl" />
              <Skeleton className="h-9 w-24 rounded-xl" />
              <Skeleton className="h-9 w-24 rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    </PageShell>
  );
}
