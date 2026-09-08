"use client";

import { AlertCircle, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ButtonLink } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";

/**
 * Espera a confirmação de um pagamento, por polling.
 *
 * Quem confirma de verdade é o webhook, em paralelo — o retorno do
 * Checkout Pro só traz o navegador de volta, nunca o status final. Sem
 * isso, a tela precisaria confiar na query string do próprio retorno, que
 * qualquer um pode forjar trocando a URL.
 *
 * Mesmo padrão de polling do painel administrativo: intervalo fixo, sem
 * websocket — conexão aberta em serverless custa uma peça a mais para
 * quebrar, e aqui é uma pessoa olhando uma tela só, por pouco tempo.
 */
const INTERVALO_MS = 2000;
const TENTATIVAS_MAXIMAS = 60; // ~2 minutos

type Status = "pendente" | "aprovado" | "rejeitado" | "cancelado" | "estornado";

export function RetornoPagamento({ pagamentoId }: { pagamentoId: string }) {
  const [status, setStatus] = useState<Status>("pendente");
  const [tentativas, setTentativas] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (status !== "pendente" || tentativas >= TENTATIVAS_MAXIMAS) return;

    const timer = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const resposta = await fetch(`/api/pagamentos/${pagamentoId}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        if (resposta.ok) {
          const dados = (await resposta.json()) as { status: Status };
          setStatus(dados.status);
        }
      } catch {
        // Falha de rede não avança nem trava — a próxima tentativa tenta de novo.
      } finally {
        setTentativas((t) => t + 1);
      }
    }, INTERVALO_MS);

    return () => {
      clearTimeout(timer);
      abortRef.current?.abort();
    };
  }, [status, tentativas, pagamentoId]);

  if (status === "aprovado") {
    return (
      <Panel className="text-center">
        <CheckCircle2 size={32} className="mx-auto text-vagas" />
        <h2 className="mt-3 font-bold">Pagamento aprovado</h2>
        <p className="mt-1.5 text-sm text-muted">
          Já está valendo. Você pode voltar para o seu perfil.
        </p>
        <ButtonLink href="/perfil" variant="vagas" size="sm" className="mt-4">
          Ir para o perfil
        </ButtonLink>
      </Panel>
    );
  }

  if (status === "rejeitado" || status === "cancelado") {
    return (
      <Panel className="text-center">
        <XCircle size={32} className="mx-auto text-danger" />
        <h2 className="mt-3 font-bold">O pagamento não foi aprovado</h2>
        <p className="mt-1.5 text-sm text-muted">
          Nada foi cobrado. Você pode tentar de novo quando quiser.
        </p>
        <ButtonLink href="/perfil" variant="outline" size="sm" className="mt-4">
          Voltar para o perfil
        </ButtonLink>
      </Panel>
    );
  }

  if (tentativas >= TENTATIVAS_MAXIMAS) {
    return (
      <Panel className="text-center">
        <AlertCircle size={32} className="mx-auto text-warn" />
        <h2 className="mt-3 font-bold">Ainda processando</h2>
        <p className="mt-1.5 text-sm text-muted">
          O Mercado Pago está demorando mais que o normal para confirmar.
          Confira seu perfil em alguns minutos — nada foi perdido.
        </p>
        <ButtonLink href="/perfil" variant="outline" size="sm" className="mt-4">
          Ir para o perfil
        </ButtonLink>
      </Panel>
    );
  }

  return (
    <Panel className="text-center">
      <Loader2 size={32} className="mx-auto animate-spin text-muted" />
      <h2 className="mt-3 font-bold">Confirmando o pagamento</h2>
      <p className="mt-1.5 text-sm text-muted">Isso leva só alguns segundos.</p>
    </Panel>
  );
}
