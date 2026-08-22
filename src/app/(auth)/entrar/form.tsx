"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { type EstadoFormulario, entrarComEstado } from "@/app/conta/actions";
import { LupaMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";

const inicial: EstadoFormulario = {};

/**
 * Para onde a pessoa vai depois de entrar.
 *
 * O papel já vinha na resposta da action — devolvido justamente para isto e
 * nunca consumido. Sem destino, quem administra caía na home e tinha que
 * descobrir sozinho o caminho do painel.
 */
function destino(papel: string | undefined): string {
  if (papel === "admin") return "/admin/painel";
  if (papel === "empresa") return "/empresa";
  return "/";
}

/**
 * Só caminho interno é aceito como destino.
 *
 * O valor vem da URL, e a URL vem de fora. Sem esta checagem,
 * `/entrar?destino=https://outro-site` transformaria a tela de login num
 * trampolim: o golpista manda o link, a pessoa entra de verdade na Lupa e
 * é despejada num site que imita a Lupa pedindo a senha de novo.
 *
 * `//` no começo também sai — o navegador lê como protocolo relativo e
 * `//evil.com` vira um endereço externo.
 */
function destinoSeguro(bruto: string | undefined): string | null {
  if (!bruto) return null;
  if (!bruto.startsWith("/") || bruto.startsWith("//")) return null;
  return bruto;
}

export function SignInForm({ destino: pretendido }: { destino?: string }) {
  const [state, action, pending] = useActionState(entrarComEstado, inicial);
  const router = useRouter();

  /**
   * O login gravava a sessão e a tela não saía do lugar.
   *
   * A action fazia tudo certo — `criarSessao` grava o cookie e
   * `revalidatePath` atualiza o layout — e devolvia `{ ok: true, papel }`.
   * Este componente só lia `state.erro`. O `ok` não tinha consumidor, então
   * o formulário se redesenhava idêntico: para quem estava do outro lado,
   * "a caixa de login recarregou". A pessoa estava logada e não sabia.
   *
   * A navegação é aqui, e não um `redirect()` na action, porque
   * `criarAcao` captura toda exceção — inclusive o NEXT_REDIRECT, que é
   * como o `redirect()` do Next funciona. Lá ele viraria mensagem de erro.
   */
  useEffect(() => {
    if (!state.ok) return;
    router.replace(destinoSeguro(pretendido) ?? destino(state.papel));
  }, [state.ok, state.papel, pretendido, router]);

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
