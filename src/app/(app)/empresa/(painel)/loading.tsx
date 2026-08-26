/*
 * O esqueleto vive num grupo de rota, e não em `empresa/`.
 *
 * `loading.tsx` cria um limite de Suspense para tudo abaixo dele: o shell
 * é transmitido antes de a página decidir, e o status HTTP já não pode
 * mudar. Em `empresa/` ele cobria a edição de vaga e a ficha do candidato,
 * que chamam `notFound()` — e as duas respondiam 200 mostrando "não
 * encontramos essa página". Um 200 no lugar de um 404 confirma para quem
 * sonda ids que o registro existe, e tira a página do índice pelo motivo
 * errado.
 *
 * O grupo `(painel)` escopa o esqueleto ao painel sem mudar a URL.
 */
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
