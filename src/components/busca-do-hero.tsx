"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { cn } from "@/lib/utils";

type Tipo = "vagas" | "servicos";

export interface Atalho {
  rotulo: string;
  href: string;
}

const OPCOES: {
  tipo: Tipo;
  rotulo: string;
  ativa: string;
  placeholder: string;
}[] = [
  {
    tipo: "vagas",
    rotulo: "Vagas",
    ativa: "bg-vagas/15 text-vagas",
    placeholder: "Cargo ou empresa",
  },
  {
    tipo: "servicos",
    rotulo: "Serviços",
    ativa: "bg-servicos/15 text-servicos",
    placeholder: "Eletricista, diarista, pintor...",
  },
];

/**
 * A busca do hero: o que procurar, onde, e um botão.
 *
 * É um formulário GET para `/vagas` ou `/servicos`, com os mesmos
 * parâmetros que a barra de filtros dessas telas já lê (`q`, `uf`). Não
 * existe busca nova no servidor: o hero só preenche a que já existe.
 *
 * **O estado começa em "Todo o Brasil", mesmo para quem tem conta.** A
 * lista já põe o que está perto primeiro; pré-filtrar pelo estado da conta
 * esconderia o resto sem a pessoa ter pedido, e ordenar não é filtrar (ver
 * AGENTS.md, "Perto se mede por região do IBGE").
 *
 * **Sem JavaScript, o formulário envia para `/vagas`.** O alternador
 * Vagas/Serviços troca o `action` por estado, e sem hidratação ele não
 * troca. Vagas é o padrão porque é a busca mais frequente; quem quer
 * serviço ainda chega pelos atalhos, que são links. Com JavaScript, a
 * navegação monta a URL sem os campos vazios (`?q=&uf=` na barra de
 * endereço não diz nada a ninguém).
 *
 * **Visitante sem conta vê, antes do clique, que vai entrar.** `/vagas` e
 * `/servicos` exigem login (decisão do Luiz, ver AGENTS.md), e uma busca
 * cujo primeiro resultado é uma tela de entrada parece quebrada. A frase
 * troca a surpresa por um aviso; o destino fica guardado e, depois do
 * login, a pessoa cai na busca que fez.
 *
 * Os campos têm 16 px: abaixo disso o Safari do iPhone amplia a página ao
 * focar (#314).
 */
export function BuscaDoHero({
  ufs,
  atalhos,
  visitante,
}: {
  ufs: { sigla: string; nome: string }[];
  atalhos: Record<Tipo, Atalho[]>;
  visitante: boolean;
}) {
  const router = useRouter();
  const [tipo, setTipo] = useState<Tipo>("vagas");
  const opcao = OPCOES.find((o) => o.tipo === tipo) ?? OPCOES[0];

  function buscar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const dados = new FormData(e.currentTarget);
    const params = new URLSearchParams();
    for (const chave of ["q", "uf"]) {
      const valor = String(dados.get(chave) ?? "").trim();
      if (valor) params.set(chave, valor);
    }
    const qs = params.toString();
    router.push(qs ? `/${tipo}?${qs}` : `/${tipo}`);
  }

  return (
    <div className="mt-7 max-w-2xl">
      <form method="GET" action={`/${tipo}`} onSubmit={buscar}>
        <fieldset className="mb-3 inline-flex min-w-0 rounded-full border border-line bg-panel p-1">
          <legend className="sr-only">O que procurar</legend>
          {OPCOES.map((o) => (
            <button
              key={o.tipo}
              type="button"
              aria-pressed={o.tipo === tipo}
              onClick={() => setTipo(o.tipo)}
              className={cn(
                "inline-flex h-11 items-center rounded-full px-5 text-sm font-semibold transition-colors",
                o.tipo === tipo ? o.ativa : "text-muted hover:text-ink",
              )}
            >
              {o.rotulo}
            </button>
          ))}
        </fieldset>

        <div className="grid grid-cols-1 gap-2 rounded-[var(--radius-card)] border border-line bg-panel p-2 shadow-lg shadow-black/5 sm:grid-cols-[1fr_13rem_auto]">
          <div className="flex h-14 items-center gap-2.5 rounded-xl border border-line bg-panel-2 px-3.5 focus-within:border-vagas">
            <Search size={18} className="flex-none text-muted" aria-hidden />
            <input
              name="q"
              type="search"
              placeholder={opcao.placeholder}
              aria-label={opcao.placeholder}
              className="h-full min-w-0 flex-1 bg-transparent text-base text-ink placeholder:text-faint focus:outline-none [&::-webkit-search-cancel-button]:hidden"
            />
          </div>
          <Select
            name="uf"
            aria-label="Estado"
            defaultValue=""
            className="h-14"
          >
            <option value="">Todo o Brasil</option>
            {ufs.map((u) => (
              <option key={u.sigla} value={u.sigla}>
                {u.nome}
              </option>
            ))}
          </Select>
          <Button type="submit" variant={tipo} size="lg" className="h-14">
            Buscar
          </Button>
        </div>
      </form>

      {visitante && (
        <p className="mt-3 text-xs text-muted">
          Para ver os resultados, entre ou crie sua conta. É grátis.
        </p>
      )}

      <ul className="mt-4 flex flex-wrap gap-2" aria-label="Mais procurados">
        {atalhos[tipo].map((a) => (
          <li key={a.href}>
            <Link
              href={a.href}
              className="inline-flex min-h-11 items-center rounded-full border border-line bg-panel px-4 text-sm font-medium text-ink transition-colors hover:bg-panel-2"
            >
              {a.rotulo}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
