/**
 * Quem responde juridicamente pela Lupa.
 *
 * Fica num lugar só porque aparece nos Termos de Uso, na Política de
 * Privacidade e na página de Suporte — e porque documento legal com a
 * identidade do responsável escrita em três lugares é documento que um dia
 * diverge. É a mesma razão de `PRECO_CENTAVOS` morar num arquivo só.
 *
 * ## Os campos pendentes, e por que não invento nenhum
 *
 * `razaoSocial` e `cnpj` estão nulos porque **ainda não existem**: a PALU
 * está em constituição (decisão do Luiz em 14/09/2026). A razão social não
 * é o que o rodapé já diz ("Palu Soluções Digitais") até o registro sair —
 * ela precisa ser a da Receita, letra por letra, porque é o que identifica
 * o controlador perante o titular.
 *
 * O `email` estava nulo pelo mesmo motivo, e deixou de estar em 22/09/2026:
 * a #240 criou e testou `suporte@lupapp.com.br`. Vem de `contato-lupa.ts`,
 * e não é repetido aqui, para o endereço do rodapé e o do documento legal
 * não divergirem.
 *
 * Política de privacidade sem controlador identificável não cumpre o
 * art. 9º da LGPD, e endereço de contato que ninguém lê é a mesma
 * promessa quebrada que este projeto registra quatro vezes — só que num
 * documento que promete um canal de direitos do titular.
 *
 * Por isso as páginas **não são publicadas** enquanto faltar qualquer um:
 * `PRONTO_PARA_PUBLICAR` responde isso, e há teste que trava. Preencher
 * razão social e CNPJ é o que libera.
 */

import { EMAIL_SUPORTE } from "./contato-lupa";

export interface Controlador {
  /** Nome pelo qual a plataforma se apresenta. */
  nomeFantasia: string;
  /** Razão social registrada. Nula enquanto a empresa não existir. */
  razaoSocial: string | null;
  /** Só dígitos. Nulo enquanto a inscrição não sair. */
  cnpj: string | null;
  /** Onde o titular exerce os direitos do art. 18 da LGPD. */
  email: string | null;
  /** Cidade-sede, que define o foro. */
  cidade: string;
  uf: string;
}

export const CONTROLADOR: Controlador = {
  nomeFantasia: "Lupa",
  razaoSocial: null,
  cnpj: null,
  email: EMAIL_SUPORTE,
  cidade: "Sinop",
  uf: "MT",
};

/**
 * Data da última revisão dos documentos.
 *
 * Aparece no rodapé das duas páginas legais porque quem lê precisa saber
 * de quando é o texto — e porque a LGPD exige avisar mudança relevante, o
 * que só faz sentido contra uma data.
 */
export const REVISADO_EM = "2026-09-14";

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
