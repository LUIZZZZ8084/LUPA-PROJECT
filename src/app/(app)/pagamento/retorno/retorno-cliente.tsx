"use client";

import { AlertCircle, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ButtonLink } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import type { TipoPagamento } from "@/server/pagamentos/tipos";

/**
 * Espera a confirmação, por polling.
 *
 * Quem confirma de verdade é o webhook, em paralelo — o retorno do
 * Mercado Pago só traz o navegador de volta, nunca o status final. Sem
 * isso, a tela precisaria confiar na query string do próprio retorno, que
 * qualquer um pode forjar trocando a URL.
 *
 * **São dois estados finais diferentes, conforme o que foi comprado.**
 * Quem assinou espera a assinatura ficar `ativa`; quem comprou crédito
 * espera o pagamento ficar `aprovado`. Esperar pelo estado errado deixa a
 * tela girando com tudo certo — foi o que aconteceu quando a assinatura
 * recorrente entrou e o polling continuou perguntando pela cobrança
 * (#164).
 *
 * Mesmo padrão de polling do painel administrativo: intervalo fixo, sem
 * websocket — conexão aberta em serverless custa uma peça a mais para
 * quebrar, e aqui é uma pessoa olhando uma tela só, por pouco tempo.
 */
const INTERVALO_MS = 2000;
const TENTATIVAS_MAXIMAS = 60; // ~2 minutos

type Rota = "assinaturas" | "pagamentos";

const DEU_CERTO: Record<Rota, string> = {
  assinaturas: "ativa",
  pagamentos: "aprovado",
};

const DEU_ERRADO: Record<Rota, readonly string[]> = {
  assinaturas: ["pausada", "cancelada"],
  pagamentos: ["rejeitado", "cancelado"],
};

/**
 * O que dizer e para onde mandar depois de aprovado — por padrão, o
 * mesmo texto genérico de sempre (vaga, para `pagamentos`; assinatura,
 * para `assinaturas`). Só ganha entrada aqui o tipo cujo destino natural
 * não é nenhum dos dois — hoje, só `curriculo_pdf` (#47): quem comprou
 * não tem painel de empresa nem assinatura para abrir, tem um PDF para
 * baixar.
 */
const DESTINO_APROVADO: Partial<
  Record<TipoPagamento, { href: string; rotulo: string; mensagem: string }>
> = {
  curriculo_pdf: {
    href: "/perfil/curriculo",
    rotulo: "Baixar currículo",
    mensagem:
      "O gerador está liberado para sempre. Baixe agora ou quando quiser — o currículo é remontado com o que estiver no seu perfil.",
  },
};

const DESTINO_RECUSADO: Partial<Record<TipoPagamento, string>> = {
  curriculo_pdf: "/perfil/curriculo",
};

export function RetornoDaCompra({
  id,
  rota,
  tipo,
}: {
  id: string;
  rota: Rota;
  tipo: TipoPagamento;
}) {
  const [status, setStatus] = useState<string | null>(null);
  const [tentativas, setTentativas] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  const aprovado = status === DEU_CERTO[rota];
  const recusado = status !== null && DEU_ERRADO[rota].includes(status);
  const resolvido = aprovado || recusado;

  useEffect(() => {
    if (resolvido || tentativas >= TENTATIVAS_MAXIMAS) return;

    const timer = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const resposta = await fetch(`/api/${rota}/${id}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        if (resposta.ok) {
          const dados = (await resposta.json()) as { status: string };
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
  }, [resolvido, tentativas, id, rota]);

  if (aprovado) {
    const destino = DESTINO_APROVADO[tipo];
    return (
      <Panel className="text-center">
        <CheckCircle2 size={32} className="mx-auto text-vagas" />
        <h2 className="mt-3 font-bold">Pagamento aprovado</h2>
        <p className="mt-1.5 text-muted text-sm">
          {destino
            ? destino.mensagem
            : rota === "assinaturas"
              ? "Sua assinatura está ativa e renova sozinha todo mês. Você pode cancelar quando quiser, no seu perfil."
              : "Suas vagas já estão na conta e não expiram. Você pode publicar quando quiser."}
        </p>
        <ButtonLink
          href={
            destino?.href ?? (rota === "assinaturas" ? "/perfil" : "/empresa")
          }
          variant="vagas"
          size="sm"
          className="mt-4"
        >
          {destino?.rotulo ??
            (rota === "assinaturas" ? "Ir para o perfil" : "Ir para o painel")}
        </ButtonLink>
      </Panel>
    );
  }

  if (recusado) {
    return (
      <Panel className="text-center">
        <XCircle size={32} className="mx-auto text-danger" />
        <h2 className="mt-3 font-bold">O pagamento não foi aprovado</h2>
        <p className="mt-1.5 text-muted text-sm">
          Nada foi cobrado. Você pode tentar de novo quando quiser.
        </p>
        <ButtonLink
          href={
            DESTINO_RECUSADO[tipo] ??
            (rota === "assinaturas"
              ? "/perfil/assinatura"
              : "/empresa/creditos")
          }
          variant="outline"
          size="sm"
          className="mt-4"
        >
          Tentar de novo
        </ButtonLink>
      </Panel>
    );
  }

  if (tentativas >= TENTATIVAS_MAXIMAS) {
    return (
      <Panel className="text-center">
        <AlertCircle size={32} className="mx-auto text-warn" />
        <h2 className="mt-3 font-bold">Ainda processando</h2>
        <p className="mt-1.5 text-muted text-sm">
          O Mercado Pago está demorando mais que o normal para confirmar.
          Confira em alguns minutos — nada foi perdido.
        </p>
        <ButtonLink
          href={
            DESTINO_APROVADO[tipo]?.href ??
            (rota === "assinaturas" ? "/perfil" : "/empresa")
          }
          variant="outline"
          size="sm"
          className="mt-4"
        >
          Continuar
        </ButtonLink>
      </Panel>
    );
  }

  return (
    <Panel className="text-center">
      <Loader2 size={32} className="mx-auto animate-spin text-muted" />
      <h2 className="mt-3 font-bold">Confirmando o pagamento</h2>
      <p className="mt-1.5 text-muted text-sm">Isso leva só alguns segundos.</p>
    </Panel>
  );
}
