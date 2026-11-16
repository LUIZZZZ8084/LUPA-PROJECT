/*
 * Rota fina: a implementação mora em `_contratacao/`, compartilhada com
 * a outra área de contratação (#189). Só o que muda entre as duas é a área.
 */

import type { Metadata } from "next";
import { AREA_EMPRESA } from "../../_contratacao/area";
import { ListaDeCandidaturas } from "../../_contratacao/lista-de-candidaturas";

export const metadata: Metadata = {
  title: "Candidatos",
};

export default function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <ListaDeCandidaturas area={AREA_EMPRESA} searchParams={searchParams} />
  );
}
