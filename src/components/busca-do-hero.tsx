"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { useCidadesDaUf } from "@/components/campo-cidade";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { cidadeComUf, type UF } from "@/lib/cidades";
import { cn } from "@/lib/utils";

type Tipo = "vagas" | "servicos";

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
 * **Escolhido o estado, aparece a cidade (#380).** Antes, só se escolhia o
 * estado, e a cidade vinha depois da busca, no filtro da lista. Agora ela é
 * oferecida logo, com "Todas as cidades" (o estado inteiro) como padrão. As
 * cidades chegam sob demanda, só as do estado escolhido, pelo mesmo gancho
 * dos formulários (`useCidadesDaUf`): são 5.571 municípios, e o celular não
 * precisa baixar todos para mostrar um. A cidade vai na URL já com o estado
 * ("Sinop - MT"), que é o formato que as listas leem e validam contra o IBGE.
 * Trocar o estado limpa a cidade: cidade de um estado com outro estado
 * escolhido é um filtro que nunca casa.
 *
 * O seletor de cidade é filho do de estado na ordem do DOM (termo, estado,
 * cidade, botão), que é a ordem de leitura e de foco no celular. No desktop o
 * cartão vira duas linhas, com o botão alto à direita, e a ordem do DOM
 * continua sendo a ordem em que o olho percorre.
 *
 * **Sem JavaScript, o formulário envia para `/vagas`.** O alternador
 * Vagas/Serviços troca o `action` por estado, e sem hidratação ele não
 * troca. Vagas é o padrão porque é a busca mais frequente; quem quer
 * serviço, sem JavaScript, usa o link "Serviços" do cabeçalho. Os atalhos
 * de categoria que existiram aqui saíram (#364), e com eles a outra porta.
 * Com JavaScript, a navegação monta a URL sem os campos vazios (`?q=&uf=`
 * na barra de endereço não diz nada a ninguém).
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
  visitante,
}: {
  ufs: { sigla: string; nome: string }[];
  visitante: boolean;
}) {
  const router = useRouter();
  const [tipo, setTipo] = useState<Tipo>("vagas");
  const [uf, setUf] = useState<UF | "">("");
  const [cidade, setCidade] = useState("");
  const nomes = useCidadesDaUf(uf || null);
  const ufRef = useRef<HTMLSelectElement>(null);

  /*
   * Quem escolhe o estado antes de a página terminar de carregar não perde a
   * escolha. O HTML do servidor já traz o seletor, e num celular com rede
   * fraca a pessoa pode usá-lo muito antes de o JavaScript chegar: o campo
   * guarda o valor, mas o estado do React ainda é "", e a cidade não
   * apareceria até ela escolher de novo. Ao montar, lê-se o que o campo já
   * tem. (O envio já lia o `FormData`, então a busca saía certa; só a cidade
   * ficava de fora.)
   */
  useEffect(() => {
    const escolhido = ufRef.current?.value;
    if (escolhido) setUf(escolhido as UF);
  }, []);
  const opcao = OPCOES.find((o) => o.tipo === tipo) ?? OPCOES[0];

  function buscar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const dados = new FormData(e.currentTarget);
    const params = new URLSearchParams();
    for (const chave of ["q", "uf", "cidade"]) {
      const valor = String(dados.get(chave) ?? "").trim();
      if (valor) params.set(chave, valor);
    }
    const qs = params.toString();
    router.push(qs ? `/${tipo}?${qs}` : `/${tipo}`);
  }

  return (
    <div className="mt-4 max-w-2xl">
      {/*
       * O cartão é o próprio formulário: alternador, termo, estado e botão
       * dentro de uma moldura só, como na referência da home (#372).
       */}
      <form
        method="GET"
        action={`/${tipo}`}
        onSubmit={buscar}
        className="rounded-[var(--radius-card)] border border-line bg-panel p-2.5 shadow-lg shadow-black/5"
      >
        <fieldset className="mb-2 inline-flex min-w-0 rounded-full border border-line bg-panel p-1">
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

        {/*
          Sem estado, uma linha: termo, estado e botão. Com estado, duas: o
          termo em cima; estado e cidade embaixo; e o botão alto à direita,
          nas duas. As posições são explícitas só no segundo caso.
        */}
        <div
          className={cn(
            "grid grid-cols-1 gap-2",
            uf
              ? "sm:grid-cols-[1fr_1fr_auto]"
              : "sm:grid-cols-[1fr_13rem_auto]",
          )}
        >
          <div
            className={cn(
              "flex h-14 items-center gap-2.5 rounded-xl border border-line bg-panel-2 px-3.5 focus-within:border-vagas",
              uf && "sm:col-span-2 sm:row-start-1",
            )}
          >
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
            ref={ufRef}
            name="uf"
            aria-label="Estado"
            value={uf}
            onChange={(e) => {
              setUf(e.target.value as UF | "");
              setCidade("");
            }}
            className={cn("h-14", uf && "sm:col-start-1 sm:row-start-2")}
          >
            <option value="">Todo o Brasil</option>
            {ufs.map((u) => (
              <option key={u.sigla} value={u.sigla}>
                {u.nome}
              </option>
            ))}
          </Select>
          {uf && (
            <Select
              name="cidade"
              aria-label="Cidade"
              aria-busy={!nomes}
              value={cidade}
              onChange={(e) => setCidade(e.target.value)}
              className="h-14 sm:col-start-2 sm:row-start-2"
            >
              <option value="">Todas as cidades</option>
              {nomes?.map((nome) => (
                <option key={nome} value={cidadeComUf(nome, uf)}>
                  {nome}
                </option>
              ))}
            </Select>
          )}
          <Button
            type="submit"
            variant={tipo}
            size="lg"
            className={cn(
              "h-14",
              uf && "sm:col-start-3 sm:row-span-2 sm:row-start-1 sm:h-auto",
            )}
          >
            Buscar
          </Button>
        </div>
      </form>

      {visitante && (
        <p className="mt-3 text-xs text-muted">
          Para ver os resultados, entre ou crie sua conta. É grátis.
        </p>
      )}
    </div>
  );
}
