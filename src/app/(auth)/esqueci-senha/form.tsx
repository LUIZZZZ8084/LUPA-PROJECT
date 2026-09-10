"use client";

import { Loader2, MailCheck } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { type EstadoRecuperacao, pedirComEstado } from "./actions";

const inicial: EstadoRecuperacao = {};

export function EsqueciSenhaForm() {
  const [state, action, pendente] = useActionState(pedirComEstado, inicial);

  /*
   * A confirmação não diz se a conta existe.
   *
   * É a mesma regra do login, e a razão é a mesma: numa cidade do tamanho
   * de Sinop, a lista de quem tem conta é a lista de quem está procurando
   * emprego, e isso pode custar o emprego atual de alguém. "Se existe uma
   * conta com esse e-mail" é a formulação que informa sem confirmar.
   */
  if (state.ok) {
    return (
      <Panel className="text-center">
        <MailCheck size={36} className="mx-auto text-vagas" />
        <h1 className="mt-4 font-bold text-lg">Confira o seu e-mail</h1>
        <p className="mx-auto mt-2 max-w-sm text-muted text-sm leading-relaxed">
          Se existe uma conta com esse e-mail, o link para criar uma senha nova
          já está a caminho. Ele vale por <strong>1 hora</strong>.
        </p>
        <p className="mx-auto mt-3 max-w-sm text-faint text-xs leading-relaxed">
          Não chegou? Olhe no spam. O e-mail pode levar alguns minutos.
        </p>
        <div className="mt-6">
          <Link href="/entrar" className="text-sm text-vagas underline">
            Voltar para entrar
          </Link>
        </div>
      </Panel>
    );
  }

  return (
    <form action={action}>
      <Panel className="space-y-5">
        <div>
          <h1 className="font-bold text-lg">Esqueci minha senha</h1>
          <p className="mt-1.5 text-muted text-sm leading-relaxed">
            Informe o e-mail da sua conta. Mandamos um link para você criar uma
            senha nova.
          </p>
        </div>

        <Field label="E-mail" required error={state.campos?.email}>
          <Input
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="voce@exemplo.com"
            required
          />
        </Field>

        {state.erro && (
          <p className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-danger text-sm">
            {state.erro}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/entrar" className="text-muted text-xs underline">
            Lembrei a senha
          </Link>
          <Button type="submit" variant="vagas" disabled={pendente}>
            {pendente && <Loader2 size={16} className="animate-spin" />}
            Enviar o link
          </Button>
        </div>
      </Panel>
    </form>
  );
}
