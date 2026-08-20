import { PageShell } from "@/components/layout/page-shell";
import {
  CardGridSkeleton,
  FilterBarSkeleton,
  PageTitleSkeleton,
  SkeletonText,
} from "@/components/ui/skeleton";

/** Mostrado pelo Next enquanto a busca de prestadores carrega. */
export default function Loading() {
  return (
    <PageShell>
      <PageTitleSkeleton />
      <FilterBarSkeleton />
      <SkeletonText w="w-44" className="mb-3 h-3" />
      <CardGridSkeleton count={6} variant="provider" />
    </PageShell>
  );
}
