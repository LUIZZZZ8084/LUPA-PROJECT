"use client";

import { Pencil, Plus, Target, Trash2 } from "lucide-react";
import { type FormEvent, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { formatMoneyBRL, formatPrecoBRL } from "@/lib/format";
import type { RespostaAcao } from "@/server/action";
import type { CustoMensal } from "@/server/custos/tipos";
import type { Funil } from "@/server/metrics/tipos";
import {
  adicionarCustoAction,
  editarCustoAction,
  removerCustoAction,
} from "../actions";

/**
 * O Lupa já se paga? (#471, #473)
 *
 * A pergunta do Luiz em 15/10/2026: "precisamos que o Lupa se pague pelo
 * menos o Supabase". O que responde é a receita **que se repete** — as
 * assinaturas ativas, pelo valor de cada uma —, porque o custo é mensal:
 * um mês bom de pacotes paga o mês e não diz nada do seguinte. O que
 * entrou nos últimos 30 dias aparece embaixo, separado, pela mesma razão
 * que o caixa separa recorrente de compra única.
 *
 * **Os custos são editados aqui mesmo (#473).** Eram uma constante no
 * código; o Luiz pediu para acrescentar contador, aluguel e o que mais
 * vier. Depois de salvar, o painel pede as métricas de novo (`aoMudar`), e
 * a cobertura é recalculada com a lista nova — a conta mora num lugar só.
 *
 * Os custos vão na ordem de cadastro, e a receita cobre o primeiro antes do
 * segundo: a pergunta era "pelo menos o Supabase", e é ele que vem
 * primeiro.
 *
 * A receita é bruta, sem a taxa do Mercado Pago nem imposto, e a tela diz
 * isso: uma barra cheia que esconde 11% de desconto é a mesma mentira do
 * "faturamento estimado" que já saiu deste painel uma vez.
 */
export function CoberturaDosCustos({
  receita,
  custos,
  aoMudar,
}: {
  receita: Funil["receita"];
  custos: CustoMensal[];
  /** Chamado depois de salvar, para o painel buscar a lista e a conta novas. */
  aoMudar: () => void;
}) {
  const [adicionando, setAdicionando] = useState(false);
  const meta = custos.reduce((s, c) => s + c.centavos, 0);
  const recorrente = receita.recorrenteAtivoCentavos;
  const fracao = meta === 0 ? 0 : Math.min(1, recorrente / meta);
  const linhas = cobrirEmOrdem(recorrente, custos);

  return (
    <Panel>
      <h2 className="flex items-center gap-2 font-semibold text-sm">
        <Target size={16} className="text-vagas" aria-hidden />O Lupa já se
        paga?
      </h2>

      <p className="mt-2 font-bold text-3xl text-ink tabular-nums">
        {formatMoneyBRL(recorrente / 100)}
        <span className="ml-1 font-normal text-muted text-sm">por mês</span>
      </p>
      <p className="mt-1 text-muted text-xs">
        de {receita.assinaturasAtivas}{" "}
        {receita.assinaturasAtivas === 1
          ? "assinatura ativa"
          : "assinaturas ativas"}
        , contra {formatPrecoBRL(meta / 100)} de custo mensal
      </p>

      {custos.length > 0 && (
        <>
          {/*
            A barra é decoração: a porcentagem vem escrita logo embaixo, e é
            ela que o leitor de tela lê.
          */}
          <div
            aria-hidden
            className="mt-3 h-2 overflow-hidden rounded-full bg-panel-3"
          >
            <div
              className="h-full rounded-full bg-vagas"
              style={{ width: `${fracao * 100}%` }}
            />
          </div>
          <p className="mt-1.5 text-muted text-xs">
            Cobre{" "}
            <strong className="text-ink">{Math.floor(fracao * 100)}%</strong> do
            custo mensal.
          </p>
        </>
      )}

      <h3 className="mt-4 font-semibold text-xs">Custos do mês</h3>
      {custos.length === 0 ? (
        <p className="mt-1.5 text-muted text-xs">
          Nenhum custo cadastrado. Acrescente o que o Lupa paga todo mês para
          ver quanto a receita cobre.
        </p>
      ) : (
        <ul className="mt-1.5 divide-y divide-line text-xs">
          {linhas.map((l) => (
            <LinhaDeCusto key={l.id} custo={l} aoMudar={aoMudar} />
          ))}
        </ul>
      )}

      {adicionando ? (
        <FormularioDeCusto
          rotuloDoBotao="Adicionar"
          aoSalvar={(nome, valor) => adicionarCustoAction({ nome, valor })}
          aoConcluir={() => {
            setAdicionando(false);
            aoMudar();
          }}
          aoCancelar={() => setAdicionando(false)}
        />
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={() => setAdicionando(true)}
        >
          <Plus size={14} aria-hidden />
          Adicionar custo
        </Button>
      )}

      <p className="mt-3 border-line border-t pt-3 text-muted text-xs">
        Entraram{" "}
        <strong className="text-ink">
          {formatMoneyBRL(receita.entrouUltimos30DiasCentavos / 100)}
        </strong>{" "}
        nos últimos 30 dias, pacotes inclusive. Valores brutos, antes da taxa do
        Mercado Pago e do imposto.
      </p>
    </Panel>
  );
}

type Linha = CustoMensal & { falta: number };

function LinhaDeCusto({
  custo,
  aoMudar,
}: {
  custo: Linha;
  aoMudar: () => void;
}) {
  const [modo, setModo] = useState<"ver" | "editar" | "remover">("ver");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  if (modo === "editar") {
    return (
      <li className="py-2">
        <FormularioDeCusto
          inicial={{ nome: custo.nome, valor: centavosEmTexto(custo.centavos) }}
          rotuloDoBotao="Salvar"
          aoSalvar={(nome, valor) =>
            editarCustoAction({ id: custo.id, nome, valor })
          }
          aoConcluir={() => {
            setModo("ver");
            aoMudar();
          }}
          aoCancelar={() => setModo("ver")}
        />
      </li>
    );
  }

  return (
    <li className="py-2">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <span className="min-w-0 text-ink">
          {custo.nome}{" "}
          <span className="text-muted tabular-nums">
            {formatPrecoBRL(custo.centavos / 100)}
          </span>
        </span>
        <span className="flex items-center gap-2">
          {custo.falta === 0 ? (
            <strong className="text-vagas">coberto</strong>
          ) : (
            <span className="text-ink tabular-nums">
              faltam {formatPrecoBRL(custo.falta / 100)}
            </span>
          )}
          {modo === "ver" && (
            <>
              <button
                type="button"
                onClick={() => setModo("editar")}
                aria-label={`Editar ${custo.nome}`}
                className="rounded-md p-1.5 text-muted transition-colors hover:bg-panel-2 hover:text-ink"
              >
                <Pencil size={14} aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => {
                  setErro(null);
                  setModo("remover");
                }}
                aria-label={`Remover ${custo.nome}`}
                className="rounded-md p-1.5 text-muted transition-colors hover:bg-panel-2 hover:text-danger"
              >
                <Trash2 size={14} aria-hidden />
              </button>
            </>
          )}
        </span>
      </div>

      {/*
        Remover pede confirmação: o custo sai da conta na hora, e um clique
        errado faria o Lupa parecer mais perto de se pagar do que está.
      */}
      {modo === "remover" && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-muted">Tirar {custo.nome} da conta?</span>
          <Button
            type="button"
            variant="danger"
            size="sm"
            disabled={pendente}
            onClick={() =>
              iniciar(async () => {
                const r = await removerCustoAction({ id: custo.id });
                if (r.ok) aoMudar();
                else setErro(r.mensagem);
              })
            }
          >
            {pendente ? "Removendo…" : "Remover"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={pendente}
            onClick={() => setModo("ver")}
          >
            Cancelar
          </Button>
        </div>
      )}
      {erro && (
        <p role="alert" className="mt-1 text-danger">
          {erro}
        </p>
      )}
    </li>
  );
}

/**
 * Nome e valor de um custo, para acrescentar ou editar.
 *
 * Controlado e com `onSubmit`, sem `action` no `<form>`: o React 19 limpa o
 * formulário de toda action que termina, até da que devolveu erro, e o
 * admin perderia o que digitou por causa de um valor mal escrito (a
 * armadilha da #291).
 */
function FormularioDeCusto({
  inicial,
  rotuloDoBotao,
  aoSalvar,
  aoConcluir,
  aoCancelar,
}: {
  inicial?: { nome: string; valor: string };
  rotuloDoBotao: string;
  aoSalvar: (nome: string, valor: string) => Promise<RespostaAcao<unknown>>;
  aoConcluir: () => void;
  aoCancelar: () => void;
}) {
  const [nome, setNome] = useState(inicial?.nome ?? "");
  const [valor, setValor] = useState(inicial?.valor ?? "");
  const [erros, setErros] = useState<Record<string, string>>({});
  const [geral, setGeral] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    iniciar(async () => {
      const r = await aoSalvar(nome, valor);
      if (r.ok) {
        aoConcluir();
        return;
      }
      const porCampo = Object.fromEntries(
        (r.campos ?? []).map((c) => [c.campo, c.mensagem]),
      );
      setErros(porCampo);
      setGeral(Object.keys(porCampo).length > 0 ? null : r.mensagem);
    });
  }

  return (
    <form onSubmit={enviar} className="mt-3 space-y-2">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_10rem]">
        <Field label="Nome" error={erros.nome}>
          <Input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex.: Contador"
            maxLength={60}
            autoComplete="off"
          />
        </Field>
        <Field label="Valor por mês (R$)" error={erros.valor}>
          <Input
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder="Ex.: 300,00"
            inputMode="decimal"
            autoComplete="off"
          />
        </Field>
      </div>
      {geral && (
        <p role="alert" className="text-danger text-xs">
          {geral}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" size="sm" variant="vagas" disabled={pendente}>
          {pendente ? "Salvando…" : rotuloDoBotao}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={pendente}
          onClick={aoCancelar}
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}

/** "133,00", para o campo de edição vir preenchido no formato que se digita. */
function centavosEmTexto(centavos: number): string {
  return (centavos / 100).toFixed(2).replace(".", ",");
}

/**
 * Quanto falta de cada custo, cobrindo um de cada vez, na ordem: a receita
 * paga o primeiro inteiro antes de chegar ao segundo.
 */
function cobrirEmOrdem(recorrente: number, custos: CustoMensal[]): Linha[] {
  const linhas: Linha[] = [];
  let sobra = recorrente;
  for (const custo of custos) {
    const coberto = Math.min(sobra, custo.centavos);
    sobra -= coberto;
    linhas.push({ ...custo, falta: custo.centavos - coberto });
  }
  return linhas;
}
