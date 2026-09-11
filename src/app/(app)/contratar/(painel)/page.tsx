/*
 * Rota fina: a implementação mora em `_contratacao/`, compartilhada com
 * a outra área de contratação (#189). Só o que muda entre as duas é a
 * área, e ela é o único parâmetro.
 */

import type { Metadata } from "next";
import { AREA_PRESTADOR } from "../../_contratacao/area";
import { PainelDeContratacao } from "../../_contratacao/painel";

export const metadata: Metadata = {
  title: "Contratar",
};

export default function Page() {
  return <PainelDeContratacao area={AREA_PRESTADOR} />;
}
