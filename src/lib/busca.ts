import { nomeDaCidade, type UF, UFS, ufDaCidade } from "./cidades";
import { cidadesDaUf, ehCidadeValida } from "./cidades/servidor";

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
 * A cidade da URL, se for mesmo um município do Brasil ("Sinop - MT").
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
  return cidade && ehCidadeValida(cidade) ? cidade : undefined;
}

/**
 * O estado da URL, se for mesmo uma sigla de estado (#301).
 *
 * Mesma razão da cidade: o valor vai para o título e para o filtro, e
 * sigla inventada não pode virar nem uma coisa nem outra.
 */
export function ufDaBusca(params: Parametros): UF | undefined {
  const uf = umParametro(params, "uf")?.toUpperCase();
  return UFS.find((u) => u.sigla === uf)?.sigla;
}

/**
 * Estado e cidade da busca, coerentes entre si (#301).
 *
 * A cidade já traz o estado ("Sinop - MT"), então link antigo com só
 * `?cidade=` continua achando o estado. E cidade de um estado com outro
 * estado escolhido é descartada: o filtro nunca casaria, e a tela
 * mostraria "nenhuma vaga" sem dizer por quê.
 */
export function lugarDaBusca(params: Parametros): {
  uf?: UF;
  cidade?: string;
} {
  const cidade = cidadeDaBusca(params);
  const uf = ufDaBusca(params) ?? ufDaCidade(cidade) ?? undefined;
  return {
    uf,
    cidade: cidade && ufDaCidade(cidade) === uf ? cidade : undefined,
  };
}

/**
 * Os filtros de lugar da barra de busca: estado e, escolhido o estado,
 * as cidades dele.
 *
 * As cidades só entram com o estado escolhido. Sem isso, a página levaria
 * 5.571 opções dentro do HTML a cada abertura — em 3G, para um filtro que
 * quase ninguém abre.
 */
export function filtrosDeLugar(uf: UF | undefined) {
  return [
    {
      key: "uf",
      placeholder: "Todo o Brasil",
      options: UFS.map((u) => ({ value: u.sigla, label: u.nome })),
      limpa: ["cidade"],
    },
    ...(uf
      ? [
          {
            key: "cidade",
            placeholder: "Todas as cidades",
            options: cidadesDaUf(uf).map((c) => ({
              value: c,
              label: nomeDaCidade(c),
            })),
          },
        ]
      : []),
  ];
}
