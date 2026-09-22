"use client";

import * as Sentry from "@sentry/nextjs";
import { Home, RotateCcw } from "lucide-react";
import { useEffect } from "react";
import { LupaMark } from "@/components/brand/logo";
import { Button, ButtonLink } from "@/components/ui/button";
import { EMAIL_SUPORTE } from "@/lib/contato-lupa";
import { isSentryEnabled } from "@/lib/observability";

/**
 * O que a pessoa vê quando uma tela quebra (#249).
 *
 * `src/lib/data.ts` lança de propósito quando uma consulta falha — servir
 * dado de exemplo como se fosse real faria alguém em Sinop gastar crédito
 * de celular atrás de uma vaga inventada. O comentário de lá prometia que
 * "página de erro é honesta", e a página não existia: a fronteira era a
 * padrão do Next, preta e em inglês, sem botão e sem caminho de volta.
 *
 * Um componente só para as três fronteiras (`(app)/error.tsx`,
 * `error.tsx` e `global-error.tsx`): a mensagem é a mesma, e três cópias
 * divergiriam na primeira vez que alguém mexesse numa só.
 */
export function ErroDaTela({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    /*
     * Só o que nasceu no navegador.
     *
     * Erro de Server Component chega aqui com `digest` e **já foi
     * capturado** por `captureRequestError`, no `instrumentation.ts`, do
     * lado do servidor. Reportar de novo contaria cada falha duas vezes — e
     * um painel que dobra os números ensina a desconfiar dele. Sem
     * `digest`, o erro nasceu num componente de cliente, e esta fronteira é
     * o único lugar que o vê.
     */
    if (isSentryEnabled && !error.digest) Sentry.captureException(error);
  }, [error]);

  const codigo = error.digest;
  const assunto = codigo ? `Erro na Lupa — código ${codigo}` : "Erro na Lupa";
  const email = `mailto:${EMAIL_SUPORTE}?subject=${encodeURIComponent(assunto)}`;

  return (
    <div className="mx-auto w-full max-w-md px-4 pt-16 pb-24 text-center">
      <LupaMark size={48} className="mx-auto opacity-60" />
      <h1 className="mt-5 text-2xl font-bold tracking-tight">
        Esta tela não abriu
      </h1>
      {/*
        Não diz "já estamos sabendo" (#237): a frase custa o relato, e o
        relato — com o código — é o que liga a experiência da pessoa ao
        evento no painel. Nem culpa a conexão dela: quem chega aqui chegou
        por falha nossa.
      */}
      <p className="mt-2 text-sm text-muted">
        Algo falhou do nosso lado ao montar esta página. Muitas vezes é
        passageiro — tente de novo.
      </p>

      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <Button type="button" onClick={reset} variant="vagas">
          <RotateCcw size={16} aria-hidden />
          Tentar de novo
        </Button>
        <ButtonLink href="/" variant="outline">
          <Home size={16} aria-hidden />
          Voltar ao início
        </ButtonLink>
      </div>

      <p className="mt-8 text-xs text-muted">
        Se continuar, escreva para{" "}
        <a href={email} className="font-medium text-ink underline">
          {EMAIL_SUPORTE}
        </a>
        {codigo ? (
          <>
            {" "}
            com o código{" "}
            <code className="rounded bg-panel-2 px-1.5 py-0.5 font-mono text-ink">
              {codigo}
            </code>{" "}
            — é o que nos deixa achar o problema.
          </>
        ) : (
          " contando o que você estava fazendo."
        )}
      </p>
    </div>
  );
}
