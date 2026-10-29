"use client";

import { Briefcase, Columns3, LayoutDashboard, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { AreaDeContratacao } from "./area";

/**
 * As abas da área de contratação (#511): Painel, Vagas, Candidatos e
 * Talentos.
 *
 * **Planos não é aba (#515).** É uma página à parte, com o caminho de volta
 * ao painel: pedido do Luiz, que a quer separada do dia a dia de contratar.
 * O painel leva até ela pelo cartão da empresa, e o perfil pelo atalho
 * "Planos e vagas". "Candidatos" é o funil (`/funil`) — o nome que a
 * empresa usa para quem se candidatou; o endereço ficou.
 *
 * **No celular as quatro cabem na largura, e nenhuma rola para fora.** Ícone
 * em cima, nome embaixo, em colunas iguais — o desenho da barra
 * inferior. A fileira que rola para o lado já escondeu um filtro inteiro na
 * busca de vagas (#460): quem não via o chip concluía que ele não existia.
 * Do `sm` para cima, ícone e nome lado a lado.
 */
const ABAS = [
  { sufixo: "", rotulo: "Painel", Icone: LayoutDashboard },
  { sufixo: "/vagas", rotulo: "Vagas", Icone: Briefcase },
  { sufixo: "/funil", rotulo: "Candidatos", Icone: Columns3 },
  { sufixo: "/talentos", rotulo: "Talentos", Icone: Users },
] as const;

export function AbasDaContratacao({ area }: { area: AreaDeContratacao }) {
  const caminho = usePathname();

  return (
    <nav
      aria-label={`Seções de ${area.nome}`}
      className="mb-5 grid grid-cols-4 gap-1 rounded-[var(--radius-card)] border border-line bg-panel p-1 sm:flex sm:gap-1"
    >
      {ABAS.map(({ sufixo, rotulo, Icone }) => {
        const destino = `${area.base}${sufixo}`;
        const ativa =
          sufixo === ""
            ? caminho === area.base
            : caminho === destino || caminho.startsWith(`${destino}/`);
        return (
          <Link
            key={rotulo}
            href={destino}
            aria-current={ativa ? "page" : undefined}
            className={cn(
              "flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl px-1 font-medium text-xs transition-colors sm:min-h-11 sm:flex-row sm:gap-1.5 sm:px-3 sm:text-sm",
              ativa
                ? "bg-empresas/12 text-empresas"
                : "text-muted hover:bg-panel-2 hover:text-ink",
            )}
          >
            <Icone size={17} aria-hidden />
            {rotulo}
          </Link>
        );
      })}
    </nav>
  );
}
