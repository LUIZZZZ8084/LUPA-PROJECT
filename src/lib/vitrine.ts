import { passouDoPrazo } from "./format";

/**
 * Se o prestador aparece na vitrine de `/servicos`, e se não, por quê (#256).
 *
 * São duas exigências, e as duas nasceram em momentos diferentes: documento
 * verificado (#114, #133) e mensalidade em dia (#170). A regra estava
 * escrita duas vezes — no filtro SQL de `getProviders` e no filtro do modo
 * demonstração — e o aviso do perfil do prestador ia ser a terceira. Com
 * três cópias, uma fica para trás: o aviso olhava só o documento, e quem
 * tinha CPF confirmado mas não tinha assinado lia "Como você aparece na
 * busca" sem aparecer em busca nenhuma.
 *
 * O filtro SQL continua em SQL — é o banco que tem que recortar, senão a
 * consulta traria prestador que não pode aparecer. O que ele filtra é esta
 * mesma regra, e o comentário lá aponta para cá.
 *
 * A ordem das duas checagens é a ordem em que a pessoa resolve: sem
 * documento não adianta assinar, porque a busca continuaria sem ela.
 */
export type MotivoForaDaVitrine = "documento" | "assinatura";

export function motivoForaDaVitrine(prestador: {
  docVerificado: boolean;
  mensalidadeValidaAte: string | null;
}): MotivoForaDaVitrine | null {
  if (!prestador.docVerificado) return "documento";
  if (
    !prestador.mensalidadeValidaAte ||
    passouDoPrazo(prestador.mensalidadeValidaAte)
  ) {
    return "assinatura";
  }
  return null;
}
