"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { type EstadoRedefinicao, redefinirComEstado } from "./actions";

const inicial: EstadoRedefinicao = {};

export function RedefinirSenhaForm({ token }: { token: string }) {
  const [state, action, pendente] = useActionState(redefinirComEstado, inicial);

  return (
    <form action={action}>
      <Panel className="space-y-5">
        <div>
          <h1 className="font-bold text-lg">Criar uma senha nova</h1>
          <p className="mt-1.5 text-muted text-sm leading-relaxed">
            Escolha uma senha que você vai lembrar. Assim que salvar, você já
            entra na sua conta.
          </p>
        </div>

        {/*
          O token viaja escondido no formulário, e não é lido da URL pelo
          cliente: `useSearchParams()` exigiria um `<Suspense>`, e esse
          boundary já deixou uma tela deste projeto invisível e inerte. Quem
          leu a URL foi a página, no servidor.
        */}
        <input type="hidden" name="token" value={token} />

        <Field
          label="Nova senha"
          required
          error={state.campos?.senha}
          hint="Pelo menos 8 caracteres."
        >
          <Input
            name="senha"
            type="password"
            autoComplete="new-password"
            required
          />
        </Field>

        {state.erro && (
          <p className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-danger text-sm">
            {state.erro}
          </p>
        )}

        {/*
          A sessão é um JWT de 7 dias e não dá para revogar antes de
          expirar — o preço registrado no AGENTS.md desde que a sessão saiu
          do banco. Quem está trocando a senha porque desconfia de acesso
          indevido precisa saber, e o lugar de dizer é aqui.
        */}
        <p className="text-faint text-xs leading-relaxed">
          Se você já estiver conectado em outro aparelho, aquela sessão continua
          valendo por até 7 dias. Se desconfia de acesso indevido, fale com o
          suporte.
        </p>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/entrar" className="text-muted text-xs underline">
            Voltar para entrar
          </Link>
          <Button type="submit" variant="vagas" disabled={pendente}>
            {pendente && <Loader2 size={16} className="animate-spin" />}
            Salvar e entrar
          </Button>
        </div>
      </Panel>
    </form>
  );
}
