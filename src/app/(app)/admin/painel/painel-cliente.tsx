"use client";

import {
  AlertCircle,
  Briefcase,
  Building2,
  MapPin,
  RefreshCw,
  TrendingUp,
  Users,
  Wrench,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Panel } from "@/components/ui/card";
import { formatMoneyBRL } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { PainelAdmin } from "@/server/metrics/tipos";

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

  const cadastrosNaJanela = painel.cadastros.reduce((s, d) => s + d.total, 0);
  const picoDiario = Math.max(1, ...painel.cadastros.map((d) => d.total));

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

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Cartao
          icone={<Users size={18} />}
          rotulo="Pessoas cadastradas"
          valor={painel.totais.usuarios}
          cor="text-ink"
        />
        <Cartao
          icone={<Wrench size={18} />}
          rotulo="Prestadores"
          valor={painel.totais.prestadores}
          cor="text-servicos"
        />
        <Cartao
          icone={<Building2 size={18} />}
          rotulo="Empresas"
          valor={painel.totais.empresas}
          cor="text-empresas"
        />
        <Cartao
          icone={<Briefcase size={18} />}
          rotulo="Vagas abertas"
          valor={painel.totais.vagasAbertas}
          cor="text-vagas"
        />
      </div>

      {/*
        Caixa.

        Este bloco dizia "Faturamento estimado" e mostrava uma projeção:
        contava empresas em `perfis_empresa.plano` e multiplicava por um
        preço de tabela. A coluna nunca teve quem escrevesse nela, então o
        número era sempre zero — e se anunciava como receita.

        Hoje sai de `pagamentos`. Não é estimativa: é o que entrou e o que
        saiu, e por isso o aviso de "projeção" saiu junto.
      */}
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

      {/* Cadastros por dia */}
      <Panel>
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold">
            Cadastros nos últimos 30 dias
          </h2>
          <span className="text-xs text-muted">
            {cadastrosNaJanela} no período
          </span>
        </div>

        <div className="mt-4 flex h-28 items-end gap-[3px]">
          {painel.cadastros.map((dia) => (
            <div
              key={dia.dia}
              className="group relative flex-1 rounded-t-sm bg-vagas/25 transition-colors hover:bg-vagas/60"
              style={{
                height: `${Math.max(2, (dia.total / picoDiario) * 100)}%`,
              }}
            >
              <span className="pointer-events-none absolute -top-7 left-1/2 hidden -translate-x-1/2 rounded bg-panel-3 px-1.5 py-0.5 text-[10px] whitespace-nowrap text-ink group-hover:block">
                {new Date(`${dia.dia}T12:00:00Z`).toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                })}
                : {dia.total}
              </span>
            </div>
          ))}
        </div>
      </Panel>

      {/* Distribuição por local */}
      <Panel>
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <MapPin size={16} className="text-vagas" />
          Onde estão
        </h2>

        {painel.locais.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Ainda sem cadastros.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {painel.locais.map((local) => {
              const maior = painel.locais[0].total;
              return (
                <li
                  key={`${local.cidade}-${local.bairro ?? "sem-bairro"}`}
                  className="flex items-center gap-3"
                >
                  <span
                    className="w-40 shrink-0 truncate text-xs text-muted"
                    title={
                      local.bairro
                        ? `${local.bairro}, ${local.cidade}`
                        : local.cidade
                    }
                  >
                    {local.bairro
                      ? `${local.bairro}, ${local.cidade}`
                      : local.cidade}
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-panel-3">
                    <div
                      className="h-full rounded-full bg-vagas transition-[width] duration-[var(--duration-slow)]"
                      style={{ width: `${(local.total / maior) * 100}%` }}
                    />
                  </div>
                  <span className="w-8 text-right text-xs tabular-nums text-ink">
                    {local.total}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function Cartao({
  icone,
  rotulo,
  valor,
  cor,
}: {
  icone: React.ReactNode;
  rotulo: string;
  valor: number;
  cor: string;
}) {
  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-panel p-4">
      <span className={cn("inline-flex", cor)}>{icone}</span>
      <p className={cn("mt-2 text-2xl font-bold tabular-nums", cor)}>
        {valor.toLocaleString("pt-BR")}
      </p>
      <p className="mt-0.5 text-[11px] text-muted">{rotulo}</p>
    </div>
  );
}
