/*
 * Rota fina: a implementação mora em `_contratacao/`, compartilhada com
 * a outra área de contratação (#189). Só o que muda entre as duas é a
 * área, e ela é o único parâmetro.
 */

import type { Metadata } from "next";
import { AREA_EMPRESA } from "../../_contratacao/area";
import { ComprarVagas } from "../../_contratacao/creditos";

export const metadata: Metadata = {
  title: "Comprar vagas",
};

export default function Page() {
  return <ComprarVagas area={AREA_EMPRESA} />;
}
