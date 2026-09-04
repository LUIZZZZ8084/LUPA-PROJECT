"use client";

import { MapPin } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LupaLogo } from "@/components/brand/logo";
import {
  MenuDoUsuario,
  type UsuarioDoMenu,
} from "@/components/layout/menu-do-usuario";
import { AlternarTema } from "@/components/theme-toggle";
import { ButtonLink } from "@/components/ui/button";
import { ESTADO_NOME, rotuloDaCidade } from "@/lib/constants";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/vagas", label: "Vagas", accent: "text-vagas" },
  { href: "/servicos", label: "Serviços", accent: "text-servicos" },
  { href: "/empresa", label: "Para empresas", accent: "text-empresas" },
] as const;

/**
 * O cabeçalho recebe a sessão por prop, resolvida no layout.
 *
 * Este componente é de cliente por causa do `usePathname`, e componente de
 * cliente não lê cookie. Trazer a sessão por contexto ou `useSearchParams`
 * reintroduziria o boundary que já deixou a barra de filtros invisível
 * neste projeto — o conteúdo era transmitido e ficava preso num
 * `<template>`.
 */
export function AppHeader({ usuario }: { usuario?: UsuarioDoMenu | null }) {
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
          {/*
            A cidade da pessoa, não a do produto. Antes era "Sinop - MT"
            fixo para todo mundo; para quem é de Sorriso, era o cabeçalho
            dizendo que aquele app não é dele.
          */}
          <span className="hidden items-center gap-1.5 text-xs text-muted sm:inline-flex">
            <MapPin size={14} className="text-vagas" />
            {usuario ? rotuloDaCidade(usuario.cidade) : ESTADO_NOME}
          </span>
          <AlternarTema />
          {usuario ? (
            <MenuDoUsuario usuario={usuario} />
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
