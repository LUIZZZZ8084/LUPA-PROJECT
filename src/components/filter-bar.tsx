"use client";

import { ChevronDown, Loader2, Search, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
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

/** Valores atuais dos filtros, lidos no servidor e repassados como props. */
export type FilterValues = Record<string, string | undefined>;

/**
 * Barra de busca e filtros das telas de Vagas e Serviços.
 *
 * O estado vive na URL, então cada busca é compartilhável e o botão voltar
 * funciona — é o que o grupo de WhatsApp não tem.
 *
 * Os valores atuais chegam por prop, do Server Component que já leu os
 * searchParams. Usar `useSearchParams()` aqui exigiria um <Suspense> em
 * volta, e esse boundary ficava pendente para sempre: o conteúdo era
 * transmitido mas nunca trocado pelo fallback, deixando a busca invisível
 * e inerte em produção.
 */
export function FilterBar({
  searchPlaceholder,
  filters,
  values,
  accent = "vagas",
}: {
  searchPlaceholder: string;
  filters: FilterDef[];
  values: FilterValues;
  accent?: "vagas" | "servicos";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  const urlQuery = values.q ?? "";
  const [query, setQuery] = useState(urlQuery);
  const [syncedQuery, setSyncedQuery] = useState(urlQuery);

  // Quando a URL muda por fora (voltar, "limpar filtros"), o campo acompanha.
  // Ajuste durante a renderização, não em efeito — evita o render extra.
  if (urlQuery !== syncedQuery) {
    setSyncedQuery(urlQuery);
    setQuery(urlQuery);
  }

  function navigate(next: URLSearchParams) {
    const qs = next.toString();
    startTransition(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  }

  function currentParams() {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(values)) {
      if (v) params.set(k, v);
    }
    return params;
  }

  function setParam(key: string, value: string) {
    const next = currentParams();
    if (value) next.set(key, value);
    else next.delete(key);
    navigate(next);
  }

  function clearFilters() {
    const next = new URLSearchParams();
    if (values.q) next.set("q", values.q);
    navigate(next);
  }

  // Busca com atraso curto para não navegar a cada tecla.
  useEffect(() => {
    if (query === urlQuery) return;
    const id = setTimeout(() => setParam("q", query), 350);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, urlQuery]);

  const activeCount = filters.filter((f) => !f.locked && values[f.key]).length;

  const focusRing =
    accent === "vagas"
      ? "focus-within:border-vagas"
      : "focus-within:border-servicos";

  return (
    /*
     * Form GET de verdade, não um <div> com JavaScript por cima.
     *
     * Antes da hidratação — ou num aparelho antigo em 3G, que é o caso de
     * boa parte do público — o filtro continua funcionando: o navegador
     * envia os campos e o servidor devolve a página filtrada. Com JS, o
     * onSubmit intercepta e a troca fica instantânea, sem recarregar.
     */
    <form
      method="GET"
      action={pathname}
      onSubmit={(e) => {
        e.preventDefault();
        const next = currentParams();
        if (query) next.set("q", query);
        else next.delete("q");
        navigate(next);
      }}
      className="mb-5 space-y-3"
    >
      <div
        className={cn(
          "flex h-12 items-center gap-2.5 rounded-xl border border-line bg-panel px-3.5",
          "transition-colors duration-200",
          focusRing,
        )}
      >
        {pending ? (
          <Loader2
            size={18}
            className={cn(
              "flex-none animate-spin",
              accent === "vagas" ? "text-vagas" : "text-servicos",
            )}
            aria-label="Buscando"
          />
        ) : (
          <Search size={18} className="flex-none text-muted" />
        )}

        <input
          name="q"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          type="search"
          className="h-full min-w-0 flex-1 bg-transparent text-sm text-ink placeholder:text-faint focus:outline-none [&::-webkit-search-cancel-button]:hidden"
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
            value={values[filter.key] ?? ""}
            onChange={(v) => setParam(filter.key, v)}
            accent={accent}
          />
        ))}

        {activeCount > 0 && (
          <button
            type="button"
            onClick={clearFilters}
            className="inline-flex h-9 flex-none items-center gap-1.5 rounded-full px-3 text-[13px] text-muted transition-colors hover:text-ink"
          >
            <X size={14} />
            Limpar filtros
          </button>
        )}
      </div>

      {/*
       * Sem JavaScript, é isto que faz o Enter no campo de busca e a troca
       * de filtro chegarem ao servidor. Fica fora da tela, mas é anunciado
       * por leitor de tela e alcançável pelo teclado.
       */}
      <button type="submit" className="sr-only">
        Aplicar filtros
      </button>
    </form>
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
        name={filter.key}
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
          "transition-colors duration-200",
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
