"use client";

import { MapPin } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LupaLogo } from "@/components/brand/logo";
import { Avatar } from "@/components/ui/avatar";
import { ButtonLink } from "@/components/ui/button";
import { PILOT_LABEL } from "@/lib/constants";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/vagas", label: "Vagas", accent: "text-vagas" },
  { href: "/servicos", label: "Serviços", accent: "text-servicos" },
  { href: "/empresa", label: "Para empresas", accent: "text-empresas" },
] as const;

export interface UsuarioDoCabecalho {
  nome: string;
  papel: string;
  avatarUrl: string | null;
}

/**
 * O cabeçalho recebe a sessão por prop, resolvida no layout.
 *
 * Este componente é de cliente por causa do `usePathname`, e componente de
 * cliente não lê cookie. Trazer a sessão por contexto ou `useSearchParams`
 * reintroduziria o boundary que já deixou a barra de filtros invisível
 * neste projeto — o conteúdo era transmitido e ficava preso num
 * `<template>`.
 */
export function AppHeader({
  usuario,
}: {
  usuario?: UsuarioDoCabecalho | null;
}) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Link href="/" aria-label="Lupa — início">
          <LupaLogo size={28} />
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Seções">
          {LINKS.map(({ href, label, accent }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? accent
                    : "text-muted hover:bg-panel-2 hover:text-ink",
                )}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <span className="hidden items-center gap-1.5 text-xs text-muted sm:inline-flex">
            <MapPin size={14} className="text-vagas" />
            {PILOT_LABEL}
          </span>
          {usuario ? (
            /*
             * Quem já entrou não pode ver "Entrar": o botão sugere que a
             * sessão não pegou, e a pessoa clica achando que precisa entrar
             * de novo.
             */
            <Link
              href="/perfil"
              /*
               * O nome fica oculto abaixo de `sm`, e o avatar sozinho não
               * dá nome ao link — no celular, que é onde a maior parte do
               * público está, o leitor de tela anunciaria só "link".
               */
              aria-label={`Perfil de ${usuario.nome}`}
              aria-current={pathname.startsWith("/perfil") ? "page" : undefined}
              className={cn(
                "flex items-center gap-2 rounded-full py-1 pl-1 pr-3 transition-colors",
                pathname.startsWith("/perfil")
                  ? "bg-panel-2"
                  : "hover:bg-panel-2",
              )}
            >
              <Avatar src={usuario.avatarUrl} name={usuario.nome} size="sm" />
              <span className="hidden max-w-[9rem] truncate text-sm font-medium sm:inline">
                {usuario.nome.split(" ")[0]}
              </span>
            </Link>
          ) : (
            <ButtonLink href="/entrar" variant="outline" size="sm">
              Entrar
            </ButtonLink>
          )}
        </div>
      </div>
    </header>
  );
}
