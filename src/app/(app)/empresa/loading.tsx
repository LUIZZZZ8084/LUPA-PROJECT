import { PageShell } from "@/components/layout/page-shell";
import { Panel } from "@/components/ui/card";
import {
  ListRowsSkeleton,
  PageTitleSkeleton,
  Skeleton,
  SkeletonAvatar,
  SkeletonText,
  StatsSkeleton,
} from "@/components/ui/skeleton";

/** Espelha o painel Minha Empresa. */
export default function Loading() {
  return (
    <PageShell>
      <PageTitleSkeleton withAction />

      <Panel>
        <div className="flex items-start gap-4">
          <SkeletonAvatar size="lg" square />
          <div className="flex-1 space-y-2.5">
            <Skeleton className="h-5 w-44" />
            <SkeletonText w="w-52" className="h-3" />
            <Skeleton className="h-6 w-40 rounded-full" />
          </div>
        </div>
        <div className="mt-5">
          <StatsSkeleton />
        </div>
      </Panel>

      <div className="mt-6 space-y-3">
        <Skeleton className="h-5 w-36" />
        <ListRowsSkeleton rows={4} />
      </div>

      <div className="mt-8 space-y-3">
        <Skeleton className="h-5 w-44" />
        <ListRowsSkeleton rows={5} />
      </div>
    </PageShell>
  );
}
