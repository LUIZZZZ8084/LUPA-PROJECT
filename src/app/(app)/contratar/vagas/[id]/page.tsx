/*
 * Rota fina: a implementação mora em `_contratacao/`, compartilhada com
 * a outra área de contratação (#189). Só o que muda entre as duas é a
 * área, e ela é o único parâmetro.
 */

import type { Metadata } from "next";
import { AREA_PRESTADOR } from "../../../_contratacao/area";
import { ProcessoDaVaga } from "../../../_contratacao/processo";

export const metadata: Metadata = {
  title: "Processo seletivo",
};

export default function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <ProcessoDaVaga
      area={AREA_PRESTADOR}
      params={params}
      searchParams={searchParams}
    />
  );
}
