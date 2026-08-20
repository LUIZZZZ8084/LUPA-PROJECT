"use client";

import { ChevronDown, Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { cn } from "@/lib/utils";

export interface FilterDef {
  /** Nome do parâmetro na URL. */
  key: string;
  /** Texto quando nada está selecionado, ex.: "Categoria". */
  placeholder: string;
  options: { value: string; label: string }[];
  /** Fixa o valor e desabilita — usado na cidade enquanto só Sinop está ativa. */
  locked?: boolean;
}

/**
 * Barra de busca e filtros das telas de Vagas e Serviços.
 *
 * O estado vive na URL (searchParams), então cada busca é compartilhável e
 * o botão voltar do navegador funciona. É o que o grupo de WhatsApp não tem.
 */
export function FilterBar({
  searchPlaceholder,
  filters,
  accent = "vagas",
}: {
  searchPlaceholder: string;
  filters: FilterDef[];
  accent?: "vagas" | "servicos";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  const urlQuery = params.get("q") ?? "";
  const [query, setQuery] = useState(urlQuery);
  const [syncedQuery, setSyncedQuery] = useState(urlQuery);

  // Quando a URL muda por fora (botão voltar, "limpar filtros"), o campo
  // acompanha. Ajuste durante a renderização, não em efeito — evita o
  // segundo render que o React desaconselha.
  if (urlQuery !== syncedQuery) {
    setSyncedQuery(urlQuery);
    setQuery(urlQuery);
  }

  function apply(next: URLSearchParams) {
    const qs = next.toString();
    startTransition(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  }

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    apply(next);
  }

  // Busca com atraso curto para não navegar a cada tecla.
  useEffect(() => {
    if (query === urlQuery) return;
    const id = setTimeout(() => setParam("q", query), 350);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, urlQuery]);

  const activeCount = filters.filter(
    (f) => !f.locked && params.get(f.key),
  ).length;

  const ring =
    accent === "vagas" ? "focus-within:border-vagas" : "focus-within:border-servicos";

  return (
    <div className="mb-5 space-y-3">
      <div
        className={cn(
          "flex h-12 items-center gap-2.5 rounded-xl border border-line bg-panel px-3.5 transition-colors",
          ring,
        )}
      >
        <Search size={18} className="flex-none text-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          className="h-full min-w-0 flex-1 bg-transparent text-sm text-ink placeholder:text-faint focus:outline-none"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Limpar busca"
            className="flex-none rounded-full p-1 text-muted transition-colors hover:bg-panel-3 hover:text-ink"
          >
            <X size={15} />
          </button>
        )}
      </div>

      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
        {filters.map((filter) => (
          <FilterSelect
            key={filter.key}
            filter={filter}
            value={params.get(filter.key) ?? ""}
            onChange={(v) => setParam(filter.key, v)}
            accent={accent}
          />
        ))}

        {activeCount > 0 && (
          <button
            type="button"
            onClick={() => {
              const next = new URLSearchParams();
              const q = params.get("q");
              if (q) next.set("q", q);
              apply(next);
            }}
            className="inline-flex h-9 flex-none items-center gap-1.5 rounded-full px-3 text-[13px] text-muted transition-colors hover:text-ink"
          >
            <X size={14} />
            Limpar filtros
          </button>
        )}
      </div>
    </div>
  );
}

function FilterSelect({
  filter,
  value,
  onChange,
  accent,
}: {
  filter: FilterDef;
  value: string;
  onChange: (value: string) => void;
  accent: "vagas" | "servicos";
}) {
  const active = Boolean(value);
  const label =
    filter.options.find((o) => o.value === value)?.label ?? filter.placeholder;

  const activeStyle =
    accent === "vagas"
      ? "border-vagas/50 bg-vagas/10 text-vagas"
      : "border-servicos/50 bg-servicos/10 text-servicos";

  return (
    <div className="relative flex-none">
      <select
        value={value}
        disabled={filter.locked}
        onChange={(e) => onChange(e.target.value)}
        aria-label={filter.placeholder}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-default"
      >
        <option value="">{filter.placeholder}</option>
        {filter.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <span
        className={cn(
          "pointer-events-none inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium",
          active ? activeStyle : "border-line bg-panel text-muted",
          filter.locked && "opacity-70",
        )}
      >
        {label}
        {!filter.locked && <ChevronDown size={14} />}
      </span>
    </div>
  );
}
