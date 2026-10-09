"use client";

import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { useEnvioQueNaoApaga } from "@/components/ui/formulario";
import { confirmarComEstado, type EstadoConfirmacao } from "./actions";

const inicial: EstadoConfirmacao = {};

/**
 * O botão que gasta o token (#398). O token viaja escondido no formulário:
 * quem leu a URL foi a página, no servidor, como na redefinição de senha.
 */
export function ConfirmarEmailForm({ token }: { token: string }) {
  const [estado, acao, pendente] = useActionState(confirmarComEstado, inicial);
  const envio = useEnvioQueNaoApaga(acao, estado);

  if (estado.ok) {
    return estado.confirmado ? <Confirmado /> : <LinkInvalido />;
  }

  return (
    <form action={acao} {...envio}>
      <input type="hidden" name="token" value={token} />
      <Panel className="space-y-4">
        <p className="text-sm leading-relaxed text-muted">
          Falta um toque: confirme que este e-mail é seu. Com ele confirmado, dá
          para recuperar a conta se você esquecer a senha.
        </p>
        {estado.erro && (
          <p className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-danger text-sm">
            {estado.erro}
          </p>
        )}
        <Button type="submit" variant="vagas" disabled={pendente}>
          {pendente && <Loader2 size={15} className="animate-spin" />}
          Confirmar meu e-mail
        </Button>
      </Panel>
    </form>
  );
}

function Confirmado() {
  return (
    <>
      <Panel className="flex items-start gap-3">
        <CheckCircle2 size={20} className="mt-0.5 flex-none text-vagas" />
        <div className="min-w-0 text-sm leading-relaxed text-muted">
          <p className="font-semibold text-ink">E-mail confirmado.</p>
          <p className="mt-1">
            Era só isso. Agora dá para recuperar a sua conta se você esquecer a
            senha — e nada tinha deixado de funcionar enquanto o e-mail não
            estava confirmado.
          </p>
        </div>
      </Panel>
      <Rodape />
    </>
  );
}

export function LinkInvalido() {
  return (
    <>
      <Panel className="flex items-start gap-3">
        <XCircle size={20} className="mt-0.5 flex-none text-warn" />
        <div className="min-w-0 text-sm leading-relaxed text-muted">
          <p className="font-semibold text-ink">Este link não vale mais.</p>
          <p className="mt-1">
            O link vale por 24 horas, só pode ser usado uma vez, e um link novo
            aposenta os anteriores. Entre na sua conta e peça outro em{" "}
            <strong className="text-ink">Perfil</strong>.
          </p>
        </div>
      </Panel>
      <Rodape />
    </>
  );
}

function Rodape() {
  return (
    <div className="mt-5 flex flex-wrap items-center gap-3">
      <ButtonLink href="/perfil" variant="vagas">
        Ir para o perfil
      </ButtonLink>
      <Link href="/vagas" className="text-muted text-xs underline">
        Ver vagas
      </Link>
    </div>
  );
}
