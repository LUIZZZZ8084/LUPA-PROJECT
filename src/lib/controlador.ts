/**
 * Quem responde juridicamente pela Lupa.
 *
 * Fica num lugar só porque aparece nos Termos de Uso, na Política de
 * Privacidade e na página de Suporte — e porque documento legal com a
 * identidade do responsável escrita em três lugares é documento que um dia
 * diverge. É a mesma razão de `PRECO_CENTAVOS` morar num arquivo só.
 *
 * ## De onde vem cada campo
 *
 * Razão social, CNPJ, endereço e cidade são os do comprovante de inscrição
 * da Receita, emitido em 24/10/2026, letra por letra: é o que identifica o
 * controlador perante o titular (art. 9º da LGPD), e um documento legal que
 * diz um nome diferente do registro não identifica ninguém. A cidade é a
 * da sede, e é ela que define o foro dos Termos — por isso é Curitiba/PR, e
 * não Sinop, onde a Lupa começou.
 *
 * O telefone do registro fica de fora de propósito: o canal de direitos do
 * titular é o e-mail, que vem de `contato-lupa.ts` (#240) para o endereço do
 * rodapé e o do documento legal não divergirem.
 *
 * As páginas só são publicadas com razão social, CNPJ e e-mail preenchidos:
 * `PRONTO_PARA_PUBLICAR` responde isso, e há teste que trava. Política de
 * privacidade sem controlador identificável não cumpre o art. 9º, e dá
 * aparência de conformidade sem entregar nenhuma.
 */

import { EMAIL_SUPORTE } from "./contato-lupa";

export interface Controlador {
  /** Nome pelo qual a plataforma se apresenta. */
  nomeFantasia: string;
  /** Razão social registrada. Nula enquanto a empresa não existir. */
  razaoSocial: string | null;
  /** Só dígitos. Nulo enquanto a inscrição não sair. */
  cnpj: string | null;
  /** Endereço da sede, como está no registro. */
  endereco: string | null;
  /** Onde o titular exerce os direitos do art. 18 da LGPD. */
  email: string | null;
  /** Cidade-sede, que define o foro. */
  cidade: string;
  uf: string;
}

export const CONTROLADOR: Controlador = {
  nomeFantasia: "Lupa",
  razaoSocial: "PALU DESENVOLVIMENTO DE SOFTWARE SOB ENCOMENDA LTDA",
  cnpj: "69787370000117",
  endereco:
    "Rua Visconde do Rio Branco, 1488, conj. 909 — Centro — CEP 80420-210",
  email: EMAIL_SUPORTE,
  cidade: "Curitiba",
  uf: "PR",
};

/**
 * Data da última revisão dos documentos.
 *
 * Aparece no rodapé das duas páginas legais porque quem lê precisa saber
 * de quando é o texto — e porque a LGPD exige avisar mudança relevante, o
 * que só faz sentido contra uma data.
 */
export const REVISADO_EM = "2026-10-26";

/**
 * As páginas legais só podem ir ao ar com o controlador identificado.
 *
 * Sem isso elas seriam pior que ausentes: um documento que promete canal
 * de direitos e não diz a quem se dirigir dá a impressão de conformidade
 * sem entregar nenhuma.
 */
export const PRONTO_PARA_PUBLICAR = Boolean(
  CONTROLADOR.razaoSocial && CONTROLADOR.cnpj && CONTROLADOR.email,
);

/** CNPJ em `00.000.000/0000-00`, ou null. */
export function cnpjFormatado(): string | null {
  const cru = CONTROLADOR.cnpj;
  if (cru?.length !== 14) return null;
  return `${cru.slice(0, 2)}.${cru.slice(2, 5)}.${cru.slice(5, 8)}/${cru.slice(8, 12)}-${cru.slice(12)}`;
}
