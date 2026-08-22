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

  return (
    <PageShell width="narrow" className="max-w-md pt-12">
      <SignInForm destino={destino} />
    </PageShell>
  );
}
