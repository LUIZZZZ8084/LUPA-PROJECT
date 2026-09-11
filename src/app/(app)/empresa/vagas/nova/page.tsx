/*
 * Rota fina: a implementação mora em `_contratacao/`, compartilhada com
 * a outra área de contratação (#189). Só o que muda entre as duas é a
 * área, e ela é o único parâmetro.
 */

import type { Metadata } from "next";
import { AREA_EMPRESA } from "../../../_contratacao/area";
import { PublicarVaga } from "../../../_contratacao/nova-vaga";

export const metadata: Metadata = {
  title: "Publicar vaga",
};

export default function Page() {
  return <PublicarVaga area={AREA_EMPRESA} />;
}
