/*
 * Rota fina: a implementação mora em `_contratacao/`, compartilhada com
 * a outra área de contratação (#189). Só o que muda entre as duas é a
 * área, e ela é o único parâmetro.
 */

import type { Metadata } from "next";
import { AREA_PRESTADOR } from "../../../_contratacao/area";
import { FichaDaCandidatura } from "../../../_contratacao/candidatura";

export const metadata: Metadata = {
  title: "Currículo recebido",
};

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return <FichaDaCandidatura params={params} area={AREA_PRESTADOR} />;
}
