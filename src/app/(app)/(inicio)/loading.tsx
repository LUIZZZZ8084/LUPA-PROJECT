import { PageShell } from "@/components/layout/page-shell";
import {
  JobCardSkeleton,
  ProfissionaisEmLinhaSkeleton,
  Skeleton,
} from "@/components/ui/skeleton";

/**
 * Espelha a home: banner, selo, cartão de busca, faixa de números, vagas e
 * profissionais em linha (#372, #376).
 *
 * As alturas são as do conteúdo real, e não palpite, porque é o esqueleto
 * que decide se a tela "pula" quando os dados chegam: banner de 10 rem no
 * celular e 17 rem a partir de `sm`; cartão de busca de 267 px com os campos
 * empilhados e 139 px com eles em linha; faixa de números de 68 px; card de
 * vaga de 161 px no celular e 140 px a partir de `sm`; profissionais em 141
 * px. As vagas são uma fila que rola no celular e uma grade de duas colunas
 * a partir de `sm`, como no conteúdo. (Medido no navegador, em 375 e em
 * 1024 px, com o conteúdo carregado.)
 *
 * Ficam de fora o aviso e o card de conta que só o visitante vê: o
 * esqueleto não sabe se há sessão, e os dois estão abaixo da dobra no
 * celular, então o que se vê primeiro não muda de lugar.
 *
 * `grid-cols-1` na fila das vagas não faz nada num contêiner flex: está ali
 * porque o teste de grades (`tests/unit/cards.test.tsx`) cobra a coluna única
 * explícita em toda grade que muda de colunas por breakpoint, e a lista da
 * home e o esqueleto usam as mesmas classes de propósito.
 */
export default function Loading() {
  return (
    <>
      <section className="aurora border-b border-line">
        <div className="mx-auto max-w-4xl px-4 pt-6 pb-8 sm:px-6 sm:pt-10 sm:pb-12">
          <Skeleton className="h-[10rem] rounded-[var(--radius-card)] sm:h-[17rem]" />
          <Skeleton className="mt-4 h-[26px] w-44 rounded-full sm:mt-6" />
          <Skeleton className="mt-3 h-[267px] max-w-2xl rounded-[var(--radius-card)] sm:h-[139px]" />
          <Skeleton className="mt-4 h-[68px] max-w-2xl rounded-2xl" />
        </div>
      </section>

      <PageShell>
        <div className="space-y-8">
          <section>
            <Skeleton className="mb-3 h-5 w-40" />
            <div className="no-scrollbar -mx-4 flex gap-3 overflow-hidden px-4 grid-cols-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0">
              {Array.from({ length: 4 }, (_, i) => (
                <JobCardSkeleton
                  key={i}
                  className="min-h-[161px] w-[17rem] flex-none sm:min-h-[140px] sm:w-auto"
                />
              ))}
            </div>
          </section>
          <section>
            <Skeleton className="mb-3 h-5 w-52" />
            <ProfissionaisEmLinhaSkeleton />
          </section>
        </div>
      </PageShell>
    </>
  );
}
