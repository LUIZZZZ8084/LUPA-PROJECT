import "server-only";

/**
 * Conferir um CNPJ na Receita, pela BrasilAPI.
 *
 * O cadastro valida o CNPJ por dígito verificador, o que prova que o número
 * é bem formado — não que a empresa existe. E não é hipótese:
 * `11222333000181`, o exemplo da nossa própria suíte, passa no dígito e é
 * uma empresa real no Rio Grande do Sul. Qualquer número inventado com o
 * dígito certo chegava à fila do admin como se fosse empresa.
 *
 * Numa plataforma de emprego isso pesa mais que a média: vaga falsa costuma
 * virar golpe de taxa de cadastro cobrada de quem está desempregado.
 *
 * A BrasilAPI é pública, sem credencial e sem custo. Ela lê os dados
 * abertos da Receita.
 */

/** Onde a consulta vive. Sem chave, sem cabeçalho, sem conta. */
const BASE = "https://brasilapi.com.br/api/cnpj/v1";

/**
 * Quanto se espera antes de desistir.
 *
 * A consulta roda numa função serverless, e uma espera longa é tempo pago
 * olhando para uma tela parada. Desistir é resultado legítimo aqui: a
 * pessoa continua podendo enviar documento, que é o caminho que sempre
 * existiu.
 */
const TIMEOUT_MS = 6000;

export interface EmpresaNaReceita {
  cnpj: string;
  razaoSocial: string;
  /** "ATIVA", "BAIXADA", "SUSPENSA", "INAPTA", "NULA". */
  situacao: string;
  uf: string | null;
  municipio: string | null;
}

/**
 * O que pode dar errado, com nome — porque cada caso pede uma frase
 * diferente na tela.
 *
 * `indisponivel` não é culpa de quem está cadastrando, e a mensagem tem que
 * dizer isso; `nao_encontrado` é.
 */
export type ResultadoConsulta =
  | { tipo: "encontrado"; empresa: EmpresaNaReceita }
  | { tipo: "nao_encontrado" }
  | { tipo: "indisponivel" };

interface RespostaBrasilApi {
  cnpj?: unknown;
  razao_social?: unknown;
  descricao_situacao_cadastral?: unknown;
  uf?: unknown;
  municipio?: unknown;
}

function texto(valor: unknown): string | null {
  return typeof valor === "string" && valor.trim() ? valor.trim() : null;
}

/**
 * A consulta em si. Nunca lança: todo erro vira `indisponivel`.
 *
 * Quem chama isto está no meio de um fluxo de produto, e uma exceção de
 * rede subindo daqui viraria tela de erro do Next para quem só queria
 * conferir o próprio CNPJ.
 */
export async function consultarCnpj(
  cnpj: string,
  buscar: typeof fetch = fetch,
): Promise<ResultadoConsulta> {
  const digitos = cnpj.replace(/\D/g, "");
  if (digitos.length !== 14) return { tipo: "nao_encontrado" };

  try {
    const resposta = await buscar(`${BASE}/${digitos}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { accept: "application/json" },
      /*
       * Sem cache do Next. O que se pergunta é "esta empresa está ativa
       * hoje", e uma resposta guardada de semanas atrás responderia outra
       * pergunta.
       */
      cache: "no-store",
    });

    if (resposta.status === 404) return { tipo: "nao_encontrado" };
    if (!resposta.ok) return { tipo: "indisponivel" };

    const dados = (await resposta.json()) as RespostaBrasilApi;
    const razaoSocial = texto(dados.razao_social);
    const situacao = texto(dados.descricao_situacao_cadastral);

    /*
     * Resposta 200 sem os dois campos que decidem tudo é resposta que não
     * serve. Tratar como indisponível, e não como "não encontrado", porque
     * o problema é do outro lado — e a diferença muda a frase na tela.
     */
    if (!razaoSocial || !situacao) return { tipo: "indisponivel" };

    return {
      tipo: "encontrado",
      empresa: {
        cnpj: digitos,
        razaoSocial,
        situacao: situacao.toUpperCase(),
        uf: texto(dados.uf),
        municipio: texto(dados.municipio),
      },
    };
  } catch {
    // Tempo esgotado, DNS, TLS, JSON quebrado: para quem está na tela é
    // tudo a mesma coisa — não deu para conferir agora.
    return { tipo: "indisponivel" };
  }
}
