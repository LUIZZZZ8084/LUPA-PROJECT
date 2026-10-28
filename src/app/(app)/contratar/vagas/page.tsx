/*
 * Rota fina: a implementação mora em `_contratacao/`, compartilhada com
 * a outra área de contratação (#189). Só o que muda entre as duas é a
 * área.
 */

import type { Metadata } from "next";
import { AREA_PRESTADOR } from "../../_contratacao/area";
import { VagasDaContratacao } from "../../_contratacao/vagas";

export const metadata: Metadata = {
  title: "Vagas",
};

export default function Page() {
  return <VagasDaContratacao area={AREA_PRESTADOR} />;
}
