"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";
import { type EstadoFormulario, entrarComEstado } from "@/app/conta/actions";
import { LupaMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";

const inicial: EstadoFormulario = {};

export function SignInForm() {
  const [state, action, pending] = useActionState(entrarComEstado, inicial);

  return (
    <>
      <div className="mb-7 text-center">
        <LupaMark size={44} className="mx-auto" />
        <h1 className="mt-4 text-2xl font-bold tracking-tight">
          Entrar na Lupa
        </h1>
        <p className="mt-1.5 text-sm text-muted">
          Trabalho e profissionais perto de você.
        </p>
      </div>

      <form action={action}>
        <Panel className="space-y-5">
          <Field label="E-mail" required>
            <Input name="email" type="email" autoComplete="email" required />
          </Field>

          <Field label="Senha" required>
            <Input
              name="senha"
              type="password"
              autoComplete="current-password"
              required
            />
          </Field>

          {state.erro && (
            <p className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
              {state.erro}
            </p>
          )}

          <Button type="submit" variant="vagas" block disabled={pending}>
            {pending && <Loader2 size={16} className="animate-spin" />}
            Entrar
          </Button>
        </Panel>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        Ainda não tem conta?{" "}
        <Link
          href="/cadastro"
          className="font-medium text-vagas hover:underline"
        >
          Criar conta gratuita
        </Link>
      </p>
    </>
  );
}
