import { Infinity as Infinito, Ticket } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { type DireitoParaTela, vagasParaPublicar } from "@/lib/planos-empresa";
import { cn } from "@/lib/utils";

const plural = (n: number, um: string, varios: string) =>
  `${n} ${n === 1 ? um : varios}`;

/**
 * Quantas vagas a empresa ainda publica, à vista (#518).
 *
 * O painel dizia o plano num selo curto e a tela de planos, numa frase; a
 * soma — o que cabe no plano, as avulsas guardadas e a primeira grátis —
 * não aparecia em lugar nenhum, e a empresa descobria que tinha acabado só
 * ao tentar publicar. A conta mora em `vagasParaPublicar`, ao lado do
 * resumo em texto, para os dois não divergirem quando a regra mudar.
 *
 * **Zero chama a atenção, e diz o que fazer.** É o único estado em que o
 * contador pede uma ação; nos outros ele só informa.
 */
export function ContadorDeVagas({
  direito,
  base,
  linkParaPlanos = true,
}: {
  direito: DireitoParaTela;
  /** A porta da área — `/empresa` ou `/contratar` (#189). */
  base: string;
  /** Na própria tela de planos o link para ela sobra. */
  linkParaPlanos?: boolean;
}) {
  const vagas = vagasParaPublicar(direito);
  const ilimitado = vagas.total === null;
  const acabou = vagas.total === 0;

  const origens = [
    ilimitado ? "Plano ilimitado" : null,
    vagas.doPlano !== null ? `${vagas.doPlano} do plano` : null,
    vagas.avulsas > 0 ? plural(vagas.avulsas, "avulsa", "avulsas") : null,
    vagas.gratis > 0 ? "1 grátis" : null,
  ].filter((o): o is string => o !== null);

  const limite = direito.mensalAtivo ? direito.limiteNoAr : null;
  const uso = limite ? Math.min(1, direito.noAr / limite) : 0;

  return (
    <section
      aria-labelledby="contador-de-vagas"
      className={cn(
        "mb-6 rounded-[var(--radius-card)] border bg-panel p-4 sm:p-5",
        acabou ? "border-warn/60" : "border-empresas/40",
      )}
    >
      <div className="flex flex-wrap items-center gap-4">
        <span
          aria-hidden
          className={cn(
            "flex h-12 w-12 flex-none items-center justify-center rounded-xl",
            acabou ? "bg-warn/15 text-warn" : "bg-empresas/15 text-empresas",
          )}
        >
          {ilimitado ? <Infinito size={22} /> : <Ticket size={22} />}
        </span>
        <div className="min-w-0 flex-1">
          <h2
            id="contador-de-vagas"
            className="font-semibold text-muted text-sm"
          >
            Vagas para publicar
          </h2>
          <p className="font-bold text-3xl tabular-nums leading-tight">
            {ilimitado ? "Ilimitado" : vagas.total}
          </p>
        </div>
        {origens.length > 0 && (
          <ul
            aria-label="De onde vêm"
            className="flex basis-full flex-wrap gap-2 sm:basis-auto"
          >
            {origens.map((o) => (
              <li key={o}>
                <Badge tone="outline">{o}</Badge>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/*
        No plano com limite, o que conta é quantas estão no ar agora — o
        lugar volta quando uma vaga sai do ar.
      */}
      {limite !== null && (
        <div className="mt-4">
          <div className="flex justify-between text-muted text-xs">
            <span>No ar agora</span>
            <span className="tabular-nums">
              {direito.noAr} de {limite}
            </span>
          </div>
          <div
            aria-hidden
            className="mt-1.5 h-2 overflow-hidden rounded-full bg-panel-3"
          >
            <div
              className={cn(
                "h-full rounded-full",
                direito.planoCheio ? "bg-warn" : "bg-empresas",
              )}
              style={{ width: `${Math.round(uso * 100)}%` }}
            />
          </div>
        </div>
      )}

      {acabou && (
        <div className="mt-3">
          <p className="text-muted text-sm leading-relaxed">
            {direito.planoCheio
              ? "Seu plano está cheio. Encerre uma vaga, compre uma avulsa ou mude de plano."
              : "Suas vagas acabaram. Compre uma avulsa ou assine um plano para publicar."}
          </p>
          {linkParaPlanos && (
            <Link
              href={`${base}/creditos`}
              className="inline-flex min-h-11 items-center font-medium text-empresas text-sm underline-offset-2 hover:underline"
            >
              Ver planos
            </Link>
          )}
        </div>
      )}
    </section>
  );
}
