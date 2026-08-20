import { PageShell } from "@/components/layout/page-shell";
import { Panel } from "@/components/ui/card";
import {
  Skeleton,
  SkeletonAvatar,
  SkeletonText,
} from "@/components/ui/skeleton";

/** Espelha o perfil do prestador: cabeçalho, selos, sobre e avaliações. */
export default function Loading() {
  return (
    <PageShell width="narrow">
      <SkeletonText w="w-44" className="mb-4 h-3.5" />

      <Panel>
        <div className="flex flex-col items-center sm:flex-row sm:items-start">
          <SkeletonAvatar size="xl" />
          <div className="mt-4 w-full flex-1 space-y-3 sm:mt-0 sm:ml-5">
            <Skeleton className="h-7 w-48" />
            <SkeletonText w="w-24" className="h-3" />
            <SkeletonText w="w-32" className="h-3" />
            <div className="flex flex-wrap gap-4 pt-1">
              <SkeletonText w="w-36" className="h-2.5" />
              <SkeletonText w="w-40" className="h-2.5" />
            </div>
          </div>
        </div>

        <div className="mt-5 flex gap-2">
          <Skeleton className="h-6 w-36 rounded-full" />
          <Skeleton className="h-6 w-40 rounded-full" />
        </div>

        <div className="mt-6 space-y-2.5 border-t border-line pt-5">
          <Skeleton className="h-4 w-24" />
          <SkeletonText />
          <SkeletonText w="w-11/12" />
          <SkeletonText w="w-3/4" />
        </div>

        <div className="mt-6 border-t border-line pt-5">
          <Skeleton className="h-13 w-full rounded-xl" />
        </div>
      </Panel>

      <Panel className="mt-5">
        <Skeleton className="h-5 w-28" />
        <div className="mt-4 flex items-center gap-6">
          <div className="space-y-2 text-center">
            <Skeleton className="h-10 w-14" />
            <Skeleton className="h-3 w-20" />
          </div>
          <div className="flex-1 space-y-1.5">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-1.5 w-full rounded-full" />
            ))}
          </div>
        </div>

        <div className="mt-6 space-y-4 border-t border-line pt-4">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="flex gap-3">
              <SkeletonAvatar size="sm" />
              <div className="flex-1 space-y-2">
                <SkeletonText w="w-32" className="h-3" />
                <SkeletonText />
                <SkeletonText w="w-2/3" />
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </PageShell>
  );
}
