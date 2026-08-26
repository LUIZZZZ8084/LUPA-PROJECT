import { ehCidadeAtendida } from "./constants";

/**
 * Leitura dos parâmetros de busca, compartilhada por `/vagas` e
 * `/servicos`.
 *
 * As duas telas liam os mesmos parâmetros com o mesmo ajudante copiado, e
 * foi assim que o `?? "Sinop"` da #76 existiu em duplicata: corrigir uma
 * cópia deixava a outra errada. Uma função só, os dois lugares.
 */

type Parametros = Record<string, string | string[] | undefined>;

/**
 * Um valor, quando a URL pode trazer vários.
 *
 * `?cidade=Sinop&cidade=Sorriso` é uma URL válida e chega como array. Sem
 * isto, o filtro receberia `["Sinop","Sorriso"]` onde espera texto e
 * compararia contra a lista inteira, que nunca casa — busca vazia sem
 * explicação nenhuma na tela.
 */
export function umParametro(
  params: Parametros,
  chave: string,
): string | undefined {
  const valor = params[chave];
  return Array.isArray(valor) ? valor[0] : valor;
}

/**
 * A cidade da URL, se for mesmo um município de MT.
 *
 * A validação existe porque o valor vai para o título da página e para a
 * descrição. `?cidade=<script>` não executa nada — o React escapa —, mas
 * viraria título de página e prévia de link compartilhado, e página que
 * ecoa qualquer texto da URL no próprio título é como se monta uma isca
 * com um domínio confiável.
 *
 * Como filtro o valor inválido já era inofensivo: não casa com nenhuma
 * cidade e a busca volta vazia.
 */
export function cidadeDaBusca(params: Parametros): string | undefined {
  const cidade = umParametro(params, "cidade");
  return cidade && ehCidadeAtendida(cidade) ? cidade : undefined;
}
