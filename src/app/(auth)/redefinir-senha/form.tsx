"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { useEnvioQueNaoApaga } from "@/components/ui/formulario";
import { SENHA_MINIMA } from "@/lib/constants";
import { type EstadoRedefinicao, redefinirComEstado } from "./actions";

const inicial: EstadoRedefinicao = {};

export function RedefinirSenhaForm({ token }: { token: string }) {
  const [state, action, pendente] = useActionState(redefinirComEstado, inicial);
  const envio = useEnvioQueNaoApaga(action, state);

  return (
    <form action={action} {...envio}>
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
          hint={`Pelo menos ${SENHA_MINIMA} caracteres.`}
        >
          <Input
            name="senha"
            type="password"
            autoComplete="new-password"
            minLength={SENHA_MINIMA}
            required
          />
        </Field>

        {state.erro && (
          <p className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-danger text-sm">
            {state.erro}
          </p>
        )}

        {/*
          Este aviso dizia o contrário até a #225: que a sessão de outro
          aparelho continuava valendo por até 7 dias, porque o JWT não
          tinha como ser revogado. Era verdade, e era a resposta errada
          para quem troca a senha justamente por desconfiar de invasão.

          Hoje a troca corta as sessões antigas, e o texto muda junto —
          promessa na tela é contrato, e contrato desatualizado engana nas
          duas direções: aqui ele faria a pessoa procurar o suporte por um
          problema que já não existe.
        */}
        <p className="text-faint text-xs leading-relaxed">
          Trocar a senha desconecta os outros aparelhos. Este aqui continua
          conectado.
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
