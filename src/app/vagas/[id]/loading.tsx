import { PageShell } from "@/components/layout/page-shell";
import { Panel } from "@/components/ui/card";
import {
  Skeleton,
  SkeletonAvatar,
  SkeletonText,
} from "@/components/ui/skeleton";

/** Espelha o detalhe da vaga: cabeçalho, quatro fatos, descrição e ação. */
export default function Loading() {
  return (
    <PageShell width="narrow">
      <SkeletonText w="w-40" className="mb-4 h-3.5" />

      <Panel>
        <div className="flex items-start gap-4">
          <SkeletonAvatar size="lg" square />
          <div className="flex-1 space-y-2.5">
            <Skeleton className="h-6 w-3/4" />
            <SkeletonText w="w-2/5" className="h-3" />
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div
              key={i}
              className="rounded-xl border border-line bg-panel-2 p-3"
            >
              <Skeleton className="h-2.5 w-14" />
              <Skeleton className="mt-2 h-3.5 w-20" />
            </div>
          ))}
        </div>

        <div className="mt-5 flex gap-2">
          <Skeleton className="h-6 w-28 rounded-full" />
          <Skeleton className="h-6 w-24 rounded-full" />
        </div>

        <div className="mt-6 space-y-2.5 border-t border-line pt-5">
          <Skeleton className="h-4 w-32" />
          <SkeletonText />
          <SkeletonText />
          <SkeletonText w="w-4/5" />
          <SkeletonText w="w-2/3" />
        </div>

        <div className="mt-6 border-t border-line pt-5">
          <Skeleton className="h-13 w-full rounded-xl" />
        </div>
      </Panel>
    </PageShell>
  );
}
