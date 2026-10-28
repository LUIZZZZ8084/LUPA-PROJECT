"use client";

import { MessageCircle } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type DragEvent, useId, useState, useTransition } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Select } from "@/components/ui/field";
import { APPLICATION_LABELS } from "@/lib/constants";
import { ESTAGIOS } from "@/lib/funil-de-candidaturas";
import type { ApplicationStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { moverCandidatura } from "./actions";
import { type MatchParaSelo, SeloDeMatch } from "./selo-de-match";

/** Um card do funil: o que a tela precisa, e nada do currículo. */
export interface CardDoFunil {
  id: string;
  nome: string;
  avatar: string | null;
  vagaId: string;
  vaga: string;
  status: ApplicationStatus;
  /** "há 2 h", calculado no servidor. */
  ha: string;
  match: MatchParaSelo | null;
  /** As perguntas eliminatórias respondidas Não (#491). */
  motivos: string[];
  /** O `wa.me` pronto, com a mensagem; nulo sem telefone. */
  whatsapp: string | null;
}

const COR_DA_COLUNA: Record<ApplicationStatus, string> = {
  enviada: "bg-servicos",
  visualizada: "bg-muted",
  entrevista: "bg-warn",
  aprovada: "bg-vagas",
  rejeitada: "bg-danger",
};

/**
 * O funil em colunas (#511): uma coluna por estágio, um card por candidatura.
 *
 * **No computador, arrasta o card para outra coluna.** O arrastar é um atalho
 * por cima do seletor de estágio que todo card tem — e é o seletor que vale
 * para teclado, leitor de tela e celular, onde arrastar com o dedo dentro de
 * uma página que rola é briga com a rolagem.
 *
 * **No celular, uma coluna por vez**, escolhida pelos botões de estágio no
 * topo, que quebram de linha em vez de rolar para o lado (#460). No `md` as
 * cinco colunas aparecem lado a lado.
 *
 * **A mudança aparece na hora**, antes da resposta do servidor, e volta se
 * ele recusar, com o motivo no card. O estado local é só o que foi movido
 * aqui (`movidos`), por cima do que veio do servidor: a revalidação traz o
 * mesmo estágio de volta, e nada precisa ser sincronizado à mão.
 *
 * **Quem não respondeu o que a vaga exigia fica à parte dentro de cada
 * coluna**, com o motivo no card — separa e não esconde (#491).
 */
export function QuadroDoFunil({
  cards,
  base,
  vagas,
  vagaEscolhida,
  estagioInicial,
}: {
  cards: CardDoFunil[];
  base: string;
  vagas: { id: string; titulo: string }[];
  vagaEscolhida: string | null;
  estagioInicial: ApplicationStatus;
}) {
  const [movidos, setMovidos] = useState<Record<string, ApplicationStatus>>({});
  const [erros, setErros] = useState<Record<string, string>>({});
  const [estagioNoCelular, setEstagioNoCelular] = useState(estagioInicial);
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [sobre, setSobre] = useState<ApplicationStatus | null>(null);
  const [, iniciar] = useTransition();
  const router = useRouter();
  const caminho = usePathname();
  const idDoFiltro = useId();

  const estagioDe = (c: CardDoFunil) => movidos[c.id] ?? c.status;

  function mover(id: string, novo: ApplicationStatus) {
    const card = cards.find((c) => c.id === id);
    if (!card) return;
    const anterior = movidos[id] ?? card.status;
    if (anterior === novo) return;

    setMovidos((m) => ({ ...m, [id]: novo }));
    setErros(({ [id]: _, ...resto }) => resto);
    iniciar(async () => {
      const resposta = await moverCandidatura({ id, status: novo });
      if (!resposta.ok) {
        setMovidos((m) => ({ ...m, [id]: anterior }));
        setErros((e) => ({ ...e, [id]: resposta.mensagem }));
      }
    });
  }

  const soltar = (estagio: ApplicationStatus) => (e: DragEvent) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain") || arrastando;
    setSobre(null);
    setArrastando(null);
    if (id) mover(id, estagio);
  };

  const porEstagio = Object.fromEntries(
    ESTAGIOS.map((e) => [e, cards.filter((c) => estagioDe(c) === e)]),
  ) as Record<ApplicationStatus, CardDoFunil[]>;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label htmlFor={idDoFiltro} className="text-muted text-sm">
            Vaga
          </label>
          <Select
            id={idDoFiltro}
            className="h-11 w-auto max-w-[16rem] py-0 pl-3 text-sm"
            value={vagaEscolhida ?? ""}
            onChange={(e) => {
              const vaga = e.target.value;
              router.replace(vaga ? `${caminho}?vaga=${vaga}` : caminho);
            }}
          >
            <option value="">Todas as vagas</option>
            {vagas.map((v) => (
              <option key={v.id} value={v.id}>
                {v.titulo}
              </option>
            ))}
          </Select>
        </div>
        <p className="hidden text-faint text-xs md:block">
          Arraste o card para mudar o estágio, ou use o seletor dele.
        </p>
      </div>

      {/* Celular: uma coluna por vez, escolhida aqui. */}
      <fieldset className="mb-3 md:hidden">
        <legend className="sr-only">Estágio</legend>
        <div className="flex flex-wrap gap-2">
          {ESTAGIOS.map((estagio) => (
            <button
              key={estagio}
              type="button"
              aria-pressed={estagioNoCelular === estagio}
              onClick={() => setEstagioNoCelular(estagio)}
              className={cn(
                "inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 font-medium text-sm transition-colors",
                estagioNoCelular === estagio
                  ? "border-empresas bg-empresas/12 text-empresas"
                  : "border-line text-muted",
              )}
            >
              {APPLICATION_LABELS[estagio]}
              <span className="tabular-nums">{porEstagio[estagio].length}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
        {ESTAGIOS.map((estagio) => {
          const lista = porEstagio[estagio];
          const atendem = lista.filter((c) => c.motivos.length === 0);
          const naoAtendem = lista.filter((c) => c.motivos.length > 0);
          return (
            <section
              key={estagio}
              aria-label={`${APPLICATION_LABELS[estagio]}: ${lista.length}`}
              onDragOver={(e) => {
                e.preventDefault();
                setSobre(estagio);
              }}
              onDragLeave={() => setSobre((s) => (s === estagio ? null : s))}
              onDrop={soltar(estagio)}
              className={cn(
                "min-w-0 flex-col rounded-[var(--radius-card)] border border-line bg-panel-2 p-2 transition-colors md:flex",
                estagioNoCelular === estagio ? "flex" : "hidden",
                sobre === estagio && "border-empresas bg-empresas/8",
              )}
            >
              <h2 className="mb-2 flex items-center justify-between gap-2 px-1 pt-1 font-semibold text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <i
                    aria-hidden
                    className={cn(
                      "size-2 flex-none rounded-full",
                      COR_DA_COLUNA[estagio],
                    )}
                  />
                  <span className="truncate">
                    {APPLICATION_LABELS[estagio]}
                  </span>
                </span>
                <span className="text-muted tabular-nums">{lista.length}</span>
              </h2>

              {lista.length === 0 ? (
                <p className="px-1 py-6 text-center text-faint text-xs">
                  Ninguém neste estágio.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {atendem.map((c) => (
                    <Cartao
                      key={c.id}
                      card={c}
                      estagio={estagio}
                      base={base}
                      erro={erros[c.id]}
                      arrastando={arrastando === c.id}
                      aoArrastar={setArrastando}
                      aoMover={mover}
                    />
                  ))}
                  {naoAtendem.length > 0 && (
                    <li className="px-1 pt-1 font-semibold text-muted text-xs">
                      Não responderam o que a vaga exigia ({naoAtendem.length})
                    </li>
                  )}
                  {naoAtendem.map((c) => (
                    <Cartao
                      key={c.id}
                      card={c}
                      estagio={estagio}
                      base={base}
                      erro={erros[c.id]}
                      arrastando={arrastando === c.id}
                      aoArrastar={setArrastando}
                      aoMover={mover}
                    />
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function Cartao({
  card,
  estagio,
  base,
  erro,
  arrastando,
  aoArrastar,
  aoMover,
}: {
  card: CardDoFunil;
  estagio: ApplicationStatus;
  base: string;
  erro: string | undefined;
  arrastando: boolean;
  aoArrastar: (id: string | null) => void;
  aoMover: (id: string, estagio: ApplicationStatus) => void;
}) {
  return (
    <li
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", card.id);
        e.dataTransfer.effectAllowed = "move";
        aoArrastar(card.id);
      }}
      onDragEnd={() => aoArrastar(null)}
      className={cn(
        "rounded-xl border border-line bg-panel p-3 md:cursor-grab",
        // Borda tracejada, e não opacidade: opacidade sobre texto derruba o
        // contraste (AGENTS.md, armadilhas).
        arrastando && "border-dashed border-empresas",
      )}
    >
      {/*
        O nome abre a ficha: é por ela que a empresa tem currículo e contato,
        e abrir marca a candidatura como vista.
      */}
      <Link
        href={`${base}/candidaturas/${card.id}`}
        className="group flex min-h-11 min-w-0 items-center gap-2.5"
      >
        <Avatar name={card.nome} src={card.avatar} size="sm" />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold text-sm underline-offset-2 group-hover:underline">
            {card.nome}
          </span>
          <span className="block truncate text-muted text-xs">{card.vaga}</span>
        </span>
      </Link>

      {card.motivos.length > 0 && (
        <p className="mt-2 text-warn text-xs leading-snug">
          Respondeu Não: {card.motivos.join(" · ")}
        </p>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <SeloDeMatch match={card.match ?? undefined} />
        <span className="text-faint text-xs">{card.ha}</span>
        {card.whatsapp && (
          <a
            href={card.whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Chamar ${card.nome} no WhatsApp`}
            className="ml-auto flex h-11 w-11 flex-none items-center justify-center rounded-lg border border-line text-muted transition-colors hover:border-vagas hover:text-vagas"
          >
            <MessageCircle size={16} aria-hidden />
          </a>
        )}
      </div>

      <Select
        aria-label={`Estágio da candidatura de ${card.nome}`}
        className="mt-2 h-11 w-full py-0 pl-3 text-xs"
        value={estagio}
        onChange={(e) => aoMover(card.id, e.target.value as ApplicationStatus)}
      >
        {ESTAGIOS.map((e) => (
          <option key={e} value={e}>
            {APPLICATION_LABELS[e]}
          </option>
        ))}
      </Select>
      {erro && (
        <p role="alert" className="mt-1 text-danger text-xs">
          {erro}
        </p>
      )}
    </li>
  );
}
