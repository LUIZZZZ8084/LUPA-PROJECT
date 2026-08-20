"use client";

import { MapPin } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LupaLogo } from "@/components/brand/logo";
import { ButtonLink } from "@/components/ui/button";
import { PILOT_LABEL } from "@/lib/constants";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/vagas", label: "Vagas", accent: "text-vagas" },
  { href: "/servicos", label: "Serviços", accent: "text-servicos" },
  { href: "/empresa", label: "Para empresas", accent: "text-empresas" },
] as const;

export function AppHeader() {
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
                  active ? accent : "text-muted hover:bg-panel-2 hover:text-ink",
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
          <ButtonLink href="/entrar" variant="outline" size="sm">
            Entrar
          </ButtonLink>
        </div>
      </div>
    </header>
  );
}
