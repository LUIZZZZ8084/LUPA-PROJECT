"use client";

import { Briefcase, Building2, Home, User, Wrench } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * A aba de contratação é a do papel de quem entrou (#190).
 *
 * Empresa e prestador contratam do mesmo jeito desde a #129, mas em áreas
 * com nomes diferentes: quem contrata um ajudante uma vez por ano não se
 * reconhece em "Empresa", e se reconhece em "Contratar".
 *
 * O candidato continua vendo "Empresa" de propósito — a página dele
 * explica que aquela área é de quem contrata, o que a #122 pôs no lugar
 * de um 404. Esconder a aba devolveria a pergunta "onde publico uma
 * vaga?" sem nenhuma resposta na tela.
 *
 * **Cada papel vê uma aba, nunca as duas.**
 */
function contratacaoDoPapel(papel: string | undefined) {
  if (papel === "prestador_servico") {
    return {
      href: "/contratar",
      label: "Contratar",
      icon: Building2,
      accent: "text-empresas",
    } as const;
  }
  return {
    href: "/empresa",
    label: "Empresa",
    icon: Building2,
    accent: "text-empresas",
  } as const;
}

function itens(papel: string | undefined) {
  return [
    { href: "/", label: "Início", icon: Home, accent: "text-ink" },
    { href: "/vagas", label: "Vagas", icon: Briefcase, accent: "text-vagas" },
    {
      href: "/servicos",
      label: "Serviços",
      icon: Wrench,
      accent: "text-servicos",
    },
    contratacaoDoPapel(papel),
    { href: "/perfil", label: "Perfil", icon: User, accent: "text-ink" },
  ] as const;
}

/**
 * Navegação inferior no mobile — o padrão que o público já conhece de
 * iFood e afins. Some no desktop, onde o header assume a navegação.
 */
/**
 * A barra inferior é o caminho de navegação no celular, que é onde o
 * público de Sinop está. Sem sessão ela não aparece: as rotas que ela
 * oferece exigem login, e mostrar atalho que devolve a tela de entrada faz
 * a pessoa concluir que o app está quebrado.
 */
export function BottomNav({
  autenticado,
  papel,
}: {
  autenticado?: boolean;
  papel?: string;
}) {
  const pathname = usePathname();

  if (!autenticado) return null;

  return (
    <nav
      aria-label="Navegação principal"
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 md:hidden",
        "border-t border-line bg-panel/95 backdrop-blur-lg",
        "pb-[env(safe-area-inset-bottom)]",
      )}
    >
      <ul className="mx-auto flex max-w-lg">
        {itens(papel).map(({ href, label, icon: Icon, accent }) => {
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors",
                  active ? accent : "text-faint hover:text-muted",
                )}
              >
                <Icon size={21} strokeWidth={active ? 2.4 : 1.8} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
