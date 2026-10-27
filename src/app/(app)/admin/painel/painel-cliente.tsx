"use client";

import { AlertCircle, RefreshCw, TrendingUp } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Panel } from "@/components/ui/card";
import { formatMoneyBRL } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { PainelAdmin } from "@/server/metrics/tipos";
import { CoberturaDosCustos } from "./cobertura-dos-custos";
import { ContasPorLugarBlocos } from "./contas-por-lugar";
import { FunilDoPainel } from "./funil";
import { PressaoNosTetos } from "./pressao-nos-tetos";
import { VisaoGeral } from "./visao-geral";

/**
 * Painel administrativo com atualização por polling.
 *
 * Polling, e não websocket, por escolha deliberada: o app roda em funções
 * serverless, onde manter conexão aberta exige um serviço à parte, com
 * custo e mais uma peça para quebrar. Num painel que uma pessoa olha,
 * recarregar a cada 15s é indistinguível de tempo real e não deixa estado
 * pendurado quando o deploy troca a instância.
 *
 * A aba em segundo plano para de pedir: ninguém precisa de métrica
 * atualizada numa janela que não está sendo olhada, e um painel esquecido
 * aberto a noite toda não deve gerar milhares de consultas.
 */
const INTERVALO_MS = 15_000;

export function PainelCliente({ inicial }: { inicial: PainelAdmin }) {
  const [painel, setPainel] = useState(inicial);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const buscar = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setCarregando(true);
    try {
      const resposta = await fetch("/api/admin/metricas?dias=30", {
        signal: controller.signal,
        cache: "no-store",
      });

      if (!resposta.ok) throw new Error(`resposta ${resposta.status}`);

      setPainel(await resposta.json());
      setErro(null);
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      // Falha de rede não apaga o dado anterior: um número velho com aviso
      // é mais útil do que uma tela em branco.
      setErro("Não foi possível atualizar agora. Mostrando a última leitura.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;

    const iniciar = () => {
      if (timer) return;
      timer = setInterval(buscar, INTERVALO_MS);
    };

    const parar = () => {
      if (!timer) return;
      clearInterval(timer);
      timer = null;
    };

    const aoTrocarVisibilidade = () => {
      if (document.hidden) {
        parar();
      } else {
        buscar();
        iniciar();
      }
    };

    if (!document.hidden) iniciar();
    document.addEventListener("visibilitychange", aoTrocarVisibilidade);

    return () => {
      parar();
      document.removeEventListener("visibilitychange", aoTrocarVisibilidade);
      abortRef.current?.abort();
    };
  }, [buscar]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted">
          Apurado{" "}
          <time dateTime={painel.apuradoEm}>
            {new Date(painel.apuradoEm).toLocaleTimeString("pt-BR")}
          </time>
          {" · atualiza a cada 15s"}
        </p>
        <button
          type="button"
          onClick={buscar}
          disabled={carregando}
          className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-[13px] text-muted transition-colors hover:text-ink disabled:opacity-60"
        >
          <RefreshCw size={13} className={cn(carregando && "animate-spin")} />
          Atualizar
        </button>
      </div>

      {erro && (
        <p className="flex items-start gap-2 rounded-xl border border-warn/30 bg-warn/10 px-4 py-3 text-sm text-warn">
          <AlertCircle size={16} className="mt-0.5 flex-none" />
          {erro}
        </p>
      )}

      {/*
        A visão geral (#507): receita, contas, lugares e funil em quatro
        cards, no lugar dos cartões de totais e das barras de cadastros.
      */}
      <VisaoGeral painel={painel} />

      {/*
        Caixa.

        Este bloco dizia "Faturamento estimado" e mostrava uma projeção:
        contava empresas em `perfis_empresa.plano` e multiplicava por um
        preço de tabela. A coluna nunca teve quem escrevesse nela, então o
        número era sempre zero — e se anunciava como receita.

        Hoje sai de `pagamentos`. Não é estimativa: é o que entrou e o que
        saiu, e por isso o aviso de "projeção" saiu junto.
      */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Panel>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <TrendingUp size={16} className="text-empresas" />
                Caixa
              </h2>
              <p className="mt-2 text-3xl font-bold tabular-nums text-empresas">
                {formatMoneyBRL(painel.caixa.liquidoCentavos / 100)}
                <span className="ml-1 text-sm font-normal text-muted">
                  líquido
                </span>
              </p>
              <p className="mt-1 text-muted text-xs">
                {formatMoneyBRL(painel.caixa.entrouCentavos / 100)} entraram em{" "}
                {painel.caixa.cobrancas}{" "}
                {painel.caixa.cobrancas === 1 ? "cobrança" : "cobranças"}
              </p>
            </div>

            <div className="text-right text-xs text-muted">
              <p>
                <strong className="text-ink">
                  {formatMoneyBRL(painel.caixa.recorrenteCentavos / 100)}
                </strong>{" "}
                de assinatura
              </p>
              {/*
              As duas saídas aparecem separadas, e só quando existem.

              Somá-las daria um total certo e uma leitura errada: devolver
              dinheiro é decisão da casa, e contestação é o cliente abrindo
              disputa no cartão — custa taxa e é sinal de fraude. Zerado,
              nenhuma das duas ocupa espaço no painel.
            */}
              {painel.caixa.estornadoCentavos > 0 && (
                <p className="mt-1">
                  <strong className="text-ink">
                    −{formatMoneyBRL(painel.caixa.estornadoCentavos / 100)}
                  </strong>{" "}
                  devolvidos
                </p>
              )}
              {painel.caixa.contestadoCentavos > 0 && (
                <p className="mt-1 text-danger">
                  <strong>
                    −{formatMoneyBRL(painel.caixa.contestadoCentavos / 100)}
                  </strong>{" "}
                  contestados ({painel.caixa.contestacoes})
                </p>
              )}
            </div>
          </div>
        </Panel>

        <CoberturaDosCustos
          receita={painel.funil.receita}
          custos={painel.custos}
          aoMudar={buscar}
        />
      </div>

      <FunilDoPainel funil={painel.funil} />

      <ContasPorLugarBlocos lugares={painel.lugares} />

      {/*
        Por último, e dentro do polling.

        Último porque em dia normal é uma lista de números pequenos, e
        bloco de zeros no topo do painel ensina a rolar por cima dele.
        Dentro do polling porque a pergunta é "está subindo agora" — ao
        contrário de "Buscas sem resultado", que fica fora justamente por
        ser insumo de uma decisão mensal.
      */}
      <PressaoNosTetos linhas={painel.pressao} />
    </div>
  );
}
