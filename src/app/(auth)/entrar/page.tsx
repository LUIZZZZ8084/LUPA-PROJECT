import type { Metadata } from "next";
import { PageShell } from "@/components/layout/page-shell";
import { SignInForm } from "./form";

export const metadata: Metadata = {
  title: "Entrar",
  description: "Acesse sua conta na Lupa.",
};

/**
 * O destino desce por prop, lido aqui no servidor.
 *
 * `useSearchParams()` no componente de cliente exigiria um `<Suspense>`, e
 * esse boundary já deixou a barra de filtros invisível neste projeto: o
 * conteúdo era transmitido mas ficava preso num `<template>`.
 */
export default async function EntrarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const bruto = params.destino;
  const destino = Array.isArray(bruto) ? bruto[0] : bruto;
  // Quem acabou de excluir a conta chega aqui (#423), e precisa ler que
  // deu certo — a tela de onde veio era de quem tem conta.
  const contaExcluida = params.conta === "excluida";

  return (
    <PageShell width="narrow" className="max-w-md pt-12">
      {contaExcluida && (
        <p
          role="status"
          className="mb-5 rounded-xl border border-line bg-panel-2 px-4 py-3 text-sm leading-relaxed"
        >
          Sua conta foi excluída, e seus dados saíram da Lupa. Se quiser voltar
          um dia, é só criar uma conta nova.
        </p>
      )}
      <SignInForm destino={destino} />
    </PageShell>
  );
}
