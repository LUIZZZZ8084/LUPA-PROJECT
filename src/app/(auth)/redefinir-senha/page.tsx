import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "@/components/layout/page-shell";
import { Panel } from "@/components/ui/card";
import { RedefinirSenhaForm } from "./form";

export const metadata: Metadata = {
  title: "Criar uma senha nova",
};

/**
 * O token desce por prop, lido aqui no servidor.
 *
 * `useSearchParams()` no componente de cliente exigiria um `<Suspense>`, e
 * esse boundary já deixou a barra de filtros invisível e inerte neste
 * projeto — mesma razão da tela de entrar.
 *
 * **A validade do token não é conferida aqui.** Quem confere é a action,
 * na mesma instrução que o gasta: checar antes e usar depois deixaria dois
 * cliques no mesmo link passarem os dois. Esta página só recusa a ausência
 * do token, que é o caso de quem abriu a URL na mão.
 */
export default async function RedefinirSenhaPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <PageShell width="narrow" className="max-w-md pt-12">
        <Panel className="text-center">
          <h1 className="font-bold text-lg">Link incompleto</h1>
          <p className="mt-2 text-muted text-sm leading-relaxed">
            Abra o link exatamente como ele chegou no seu e-mail. Se ele já
            passou de 1 hora, peça um novo.
          </p>
          <div className="mt-6">
            <Link
              href="/esqueci-senha"
              className="text-sm text-vagas underline"
            >
              Pedir um link novo
            </Link>
          </div>
        </Panel>
      </PageShell>
    );
  }

  return (
    <PageShell width="narrow" className="max-w-md pt-12">
      <RedefinirSenhaForm token={token} />
    </PageShell>
  );
}
