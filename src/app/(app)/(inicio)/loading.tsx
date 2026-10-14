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
 * No computador (#443) a home usa a largura do cabeçalho e, a partir de
 * `xl`, as vagas ao lado dos profissionais, e o esqueleto segue as mesmas
 * colunas. Desde a #465 a busca e os números moram dentro do banner a partir
 * de `lg`, e o esqueleto é um bloco só, com a altura do hero de quem tem
 * conta: 534 px, igual em 1024, 1280 e 1920 (medido no navegador). O do
 * visitante é mais alto, pelo aviso e pelo card de conta, e cresce para baixo
 * sem mover o que já estava à vista.
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
        <div className="mx-auto max-w-6xl px-4 pt-6 pb-8 sm:px-6 sm:pt-10 sm:pb-12">
          <Skeleton className="h-[10rem] rounded-[var(--radius-card)] sm:h-[17rem] lg:h-[534px]" />
          <div className="lg:hidden">
            <Skeleton className="mt-4 h-[26px] w-44 rounded-full sm:mt-6" />
            <Skeleton className="mt-3 h-[267px] max-w-2xl rounded-[var(--radius-card)] sm:h-[139px]" />
            <Skeleton className="mt-4 h-[68px] max-w-2xl rounded-2xl" />
          </div>
        </div>
      </section>

      <PageShell width="wide">
        <div className="grid grid-cols-1 gap-y-8 xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start xl:gap-x-8">
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
            <ProfissionaisEmLinhaSkeleton className="grid-cols-4 sm:max-w-lg xl:max-w-none xl:grid-cols-2 xl:gap-3" />
          </section>
        </div>
      </PageShell>
    </>
  );
}
