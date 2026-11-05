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

interface Caminho {
  href: string;
  rotulo: string;
}

/**
 * O que dizer e para onde mandar depois de aprovado.
 *
 * O fim da compra é o que fica na memória (regra do pico e do fim, #551).
 * Antes, quem pagava um plano de vagas lia "Seu plano está ativo" e ganhava
 * um botão para o perfil, longe do que tinha acabado de comprar. Agora a
 * tela diz o que acontece a seguir, em passos curtos, e o botão principal é
 * o próximo passo de verdade: publicar a vaga, ou baixar o currículo.
 * `continuar` é para onde vai o "Continuar" de quando a confirmação demora.
 */
interface DepoisDeAprovar {
  mensagem: string;
  passos?: readonly string[];
  principal: Caminho;
  secundario?: Caminho;
  continuar: string;
  cor: "vagas" | "empresas";
}

const PASSOS_DA_VAGA = [
  "Publique a vaga: o cargo, o salário e o que ela pede.",
  "Os currículos chegam no painel, na aba Candidatos.",
  "Chame quem combinar pelo WhatsApp, direto da ficha.",
] as const;

function depoisDeAprovar(
  tipo: TipoPagamento,
  rota: Rota,
  base: string,
): DepoisDeAprovar {
  const vaga = {
    passos: PASSOS_DA_VAGA,
    principal: { href: `${base}/vagas/nova`, rotulo: "Publicar uma vaga" },
    secundario: { href: base, rotulo: "Ir para o painel" },
    continuar: base,
    cor: "empresas",
  } as const;

  switch (tipo) {
    case "empresa_plano_5":
    case "empresa_plano_10":
    case "empresa_mensal":
      return {
        ...vaga,
        mensagem:
          "Seu plano está ativo e renova sozinho todo mês. Para cancelar a renovação ou trocar de plano, abra Planos e vagas, no seu perfil.",
      };
    case "empresa_vaga_avulsa":
      return {
        ...vaga,
        mensagem:
          "Sua vaga já está na conta e não expira. Publique agora ou quando quiser.",
      };
    case "curriculo_pdf":
      return {
        mensagem:
          "O gerador está liberado para sempre. Baixe agora ou quando quiser — o currículo é remontado com o que estiver no seu perfil.",
        passos: [
          "Confira o perfil: o PDF mostra só o que está preenchido.",
          "Baixe o PDF e anexe onde precisar, quantas vezes quiser.",
        ],
        principal: { href: "/perfil/curriculo", rotulo: "Baixar currículo" },
        secundario: { href: "/perfil/editar", rotulo: "Completar meu perfil" },
        continuar: "/perfil/curriculo",
        cor: "vagas",
      };
  }

  return rota === "assinaturas"
    ? {
        mensagem:
          "Sua assinatura está ativa e renova sozinha todo mês. Você pode cancelar quando quiser, no seu perfil.",
        principal: { href: "/perfil", rotulo: "Ir para o perfil" },
        continuar: "/perfil",
        cor: "vagas",
      }
    : {
        ...vaga,
        mensagem:
          "Sua vaga já está na conta e não expira. Publique agora ou quando quiser.",
      };
}

const DESTINO_RECUSADO: Partial<Record<TipoPagamento, string>> = {
  curriculo_pdf: "/perfil/curriculo",
};

export function RetornoDaCompra({
  id,
  rota,
  tipo,
  base,
}: {
  id: string;
  rota: Rota;
  tipo: TipoPagamento;
  /** A área de contratação de quem pagou: `/empresa` ou `/contratar`. */
  base: string;
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
    const depois = depoisDeAprovar(tipo, rota, base);
    return (
      <Panel className="text-center">
        <CheckCircle2 size={32} className="mx-auto text-vagas" />
        <h2 className="mt-3 font-bold">Pagamento aprovado</h2>
        <p className="mt-1.5 text-muted text-sm">{depois.mensagem}</p>
        {depois.passos && (
          <div className="mt-4 rounded-xl bg-panel-2 p-4 text-left">
            <p className="font-semibold text-sm">O que fazer agora</p>
            <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-muted text-sm leading-snug">
              {depois.passos.map((passo) => (
                <li key={passo}>{passo}</li>
              ))}
            </ol>
          </div>
        )}
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <ButtonLink
            href={depois.principal.href}
            variant={depois.cor}
            size="sm"
          >
            {depois.principal.rotulo}
          </ButtonLink>
          {depois.secundario && (
            <ButtonLink
              href={depois.secundario.href}
              variant="outline"
              size="sm"
            >
              {depois.secundario.rotulo}
            </ButtonLink>
          )}
        </div>
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
          href={depoisDeAprovar(tipo, rota, base).continuar}
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
