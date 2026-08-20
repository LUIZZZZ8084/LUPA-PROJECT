import { PageShell } from "@/components/layout/page-shell";
import {
  CardGridSkeleton,
  FilterBarSkeleton,
  PageTitleSkeleton,
  SkeletonText,
} from "@/components/ui/skeleton";

/** Mostrado pelo Next enquanto a busca de vagas carrega no servidor. */
export default function Loading() {
  return (
    <PageShell>
      <PageTitleSkeleton />
      <FilterBarSkeleton />
      <SkeletonText w="w-36" className="mb-3 h-3" />
      <CardGridSkeleton count={6} variant="job" />
    </PageShell>
  );
}
