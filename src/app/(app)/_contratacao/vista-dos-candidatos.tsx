import { Columns3, List } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { AreaDeContratacao } from "./area";

/**
 * Quadro ou lista, na aba Candidatos (#620). São dois endereços, e não um
 * parâmetro: a barra de filtros da lista remonta a URL só com os filtros, e
 * um `?ver=lista` se perderia a cada busca.
 */
export function VistaDosCandidatos({
  area,
  atual,
}: {
  area: AreaDeContratacao;
  atual: "quadro" | "lista";
}) {
  const opcoes = [
    {
      chave: "quadro",
      rotulo: "Quadro",
      href: `${area.base}/funil`,
      Icone: Columns3,
    },
    {
      chave: "lista",
      rotulo: "Lista",
      href: `${area.base}/candidaturas`,
      Icone: List,
    },
  ] as const;

  return (
    <nav aria-label="Ver candidatos em" className="mb-4 flex gap-2">
      {opcoes.map(({ chave, rotulo, href, Icone }) => (
        <Link
          key={chave}
          href={href}
          aria-current={atual === chave ? "page" : undefined}
          className={cn(
            "inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 font-medium text-sm transition-colors",
            atual === chave
              ? "border-empresas bg-empresas/12 text-empresas"
              : "border-line text-muted hover:text-ink",
          )}
        >
          <Icone size={15} aria-hidden />
          {rotulo}
        </Link>
      ))}
    </nav>
  );
}
