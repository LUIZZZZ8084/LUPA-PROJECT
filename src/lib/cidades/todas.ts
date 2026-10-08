/**
 * Todos os municípios do Brasil, por estado — só no servidor.
 *
 * GERADO POR `node scripts/gerar-cidades.mjs` — não edite à mão.
 * Fonte: API de localidades do IBGE. Gerado em 2026-10-01.
 *
 * `server-only` é a trava: são 5571 nomes, e um componente
 * de cliente que importasse isto mandaria todos ao celular. Com a trava,
 * o build quebra antes.
 */

import "server-only";

import { CIDADES as AC } from "./dados/AC";
import { CIDADES as AL } from "./dados/AL";
import { CIDADES as AM } from "./dados/AM";
import { CIDADES as AP } from "./dados/AP";
import { CIDADES as BA } from "./dados/BA";
import { CIDADES as CE } from "./dados/CE";
import { CIDADES as DF } from "./dados/DF";
import { CIDADES as ES } from "./dados/ES";
import { CIDADES as GO } from "./dados/GO";
import { CIDADES as MA } from "./dados/MA";
import { CIDADES as MG } from "./dados/MG";
import { CIDADES as MS } from "./dados/MS";
import { CIDADES as MT } from "./dados/MT";
import { CIDADES as PA } from "./dados/PA";
import { CIDADES as PB } from "./dados/PB";
import { CIDADES as PE } from "./dados/PE";
import { CIDADES as PI } from "./dados/PI";
import { CIDADES as PR } from "./dados/PR";
import { CIDADES as RJ } from "./dados/RJ";
import { CIDADES as RN } from "./dados/RN";
import { CIDADES as RO } from "./dados/RO";
import { CIDADES as RR } from "./dados/RR";
import { CIDADES as RS } from "./dados/RS";
import { CIDADES as SC } from "./dados/SC";
import { CIDADES as SE } from "./dados/SE";
import { CIDADES as SP } from "./dados/SP";
import { CIDADES as TO } from "./dados/TO";
import type { UF } from "./indice";

export const CIDADES_POR_UF: Record<UF, readonly string[]> = {
  AC,
  AL,
  AM,
  AP,
  BA,
  CE,
  DF,
  ES,
  GO,
  MA,
  MG,
  MS,
  MT,
  PA,
  PB,
  PE,
  PI,
  PR,
  RJ,
  RN,
  RO,
  RR,
  RS,
  SC,
  SE,
  SP,
  TO,
};
