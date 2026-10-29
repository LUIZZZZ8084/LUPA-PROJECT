import type { TipoPagamento } from "@/server/pagamentos/tipos";

/**
 * As opções de vaga, com o texto que explica cada uma (#489).
 *
 * Fonte única para `/empresa/creditos` e para a seleção de plano no fim
 * do cadastro (#184) — o preço e o limite vêm de `PRECO_CENTAVOS` e
 * `VAGAS_NO_AR_POR_PLANO` (`src/server/pagamentos/planos.ts`); isto aqui é
 * só o rótulo e para quem cada opção faz sentido, para as duas telas não
 * divergirem no texto quando uma mudar e a outra não acompanhar.
 *
 * São quatro, e não mais a lista de três pacotes de antes: uma compra
 * avulsa e três planos mensais. Os pacotes de 5 e 10 não renovavam, e
 * quem os comprava não tinha motivo para voltar.
 */
export interface OpcaoDeVaga {
  tipo: TipoPagamento;
  nome: string;
  paraQuem: string;
  destaque?: boolean;
}

export const OPCAO_AVULSA: OpcaoDeVaga = {
  tipo: "empresa_vaga_avulsa",
  nome: "1 vaga",
  paraQuem: "Para quem tem uma vaga só, agora. Compra única, não renova.",
};

export const PLANOS_DE_VAGA: readonly OpcaoDeVaga[] = [
  {
    tipo: "empresa_plano_5",
    nome: "Plano 5",
    paraQuem: "Para quem contrata sempre, em pequena escala.",
  },
  {
    tipo: "empresa_plano_10",
    nome: "Plano 10",
    paraQuem: "Para quem tem várias vagas abertas por vez.",
  },
  {
    tipo: "empresa_mensal",
    nome: "Ilimitado",
    paraQuem: "Para quem contrata o tempo todo e não quer contar.",
    destaque: true,
  },
];

/** O que as telas sabem do direito de publicar, sem importar o servidor. */
export interface DireitoParaTela {
  pode: boolean;
  mensalAtivo: boolean;
  limiteNoAr: number | null;
  noAr: number;
  planoCheio: boolean;
  creditos: number;
  primeiraGratis: boolean;
}

const plural = (n: number, um: string, varios: string) =>
  n === 1 ? um : varios;

/**
 * O título e a frase que dizem à empresa o que ela pode publicar agora.
 *
 * Existe em um lugar só porque a mesma resposta aparece no painel, no
 * formulário de publicar e no perfil — e três textos escritos à mão
 * divergem na primeira vez que a regra mudar. A ordem é a de
 * `gastarParaPublicar`: plano com lugar, primeira grátis, crédito.
 */
export function resumoDoDireito(d: DireitoParaTela): {
  titulo: string;
  detalhe: string;
} {
  if (d.planoCheio) {
    return {
      titulo: `Seu plano está cheio: ${d.noAr} de ${d.limiteNoAr} no ar`,
      detalhe:
        d.creditos > 0
          ? "Publicar agora usa uma vaga avulsa do saldo."
          : "Encerre uma vaga, compre uma avulsa ou mude de plano.",
    };
  }

  if (d.mensalAtivo && d.limiteNoAr !== null) {
    const cabem = d.limiteNoAr - d.noAr;
    return {
      titulo: `Plano de ${d.limiteNoAr}: ${d.noAr} no ar`,
      detalhe: `Cabem mais ${cabem} ${plural(cabem, "vaga", "vagas")}, sem tirar do saldo.`,
    };
  }

  if (d.mensalAtivo) {
    return {
      titulo: "Plano ilimitado ativo",
      detalhe:
        "Publique quantas vagas quiser enquanto o plano estiver ativo, sem tirar do saldo.",
    };
  }

  if (d.primeiraGratis) {
    return {
      titulo: "Sua primeira vaga é por nossa conta",
      detalhe:
        "Empresa com CNPJ conferido publica a primeira de graça. Depois, vagas avulsas ou plano.",
    };
  }

  if (d.creditos > 0) {
    return {
      titulo:
        d.creditos === 1
          ? "Você tem 1 vaga para publicar"
          : `Você tem ${d.creditos} vagas para publicar`,
      detalhe: "Publicar usa uma delas. Cada vaga fica 30 dias no ar.",
    };
  }

  return {
    titulo: "Você não tem vagas para publicar",
    detalhe: "Compre antes de escrever a vaga, ou assine um plano.",
  };
}

/** Quantas vagas a empresa ainda publica, e de onde vem cada uma (#518). */
export interface VagasParaPublicar {
  /** A soma das três fontes; `null` é o plano ilimitado, que não se conta. */
  total: number | null;
  /** Quantas ainda cabem no plano, ou `null` sem plano com limite. */
  doPlano: number | null;
  avulsas: number;
  gratis: number;
}

/**
 * O número do contador do painel: tudo o que ainda dá para publicar.
 *
 * Soma as mesmas três fontes que `gastarParaPublicar` gasta, na mesma
 * ordem — o lugar no plano, a primeira grátis e o saldo avulso. Mostrar só
 * uma delas faria o número mentir para quem tem duas: plano cheio com saldo
 * guardado ainda publica, e o contador dizer "0" ali a mandaria comprar o
 * que já tem.
 */
export function vagasParaPublicar(d: DireitoParaTela): VagasParaPublicar {
  const gratis = d.primeiraGratis ? 1 : 0;

  if (d.mensalAtivo && d.limiteNoAr === null) {
    return { total: null, doPlano: null, avulsas: d.creditos, gratis };
  }

  const doPlano =
    d.mensalAtivo && d.limiteNoAr !== null
      ? Math.max(0, d.limiteNoAr - d.noAr)
      : null;

  return {
    total: (doPlano ?? 0) + d.creditos + gratis,
    doPlano,
    avulsas: d.creditos,
    gratis,
  };
}

/**
 * O selo curto — "Plano de 5 ativo", "3 vagas para publicar" — do painel e
 * do perfil da empresa.
 *
 * Aceita o direito inteiro ou só o que o selo lê: o perfil recebe o valor
 * por prop, e o teste de componente dele monta só o que importa.
 */
export function seloDoDireito(d: {
  mensalAtivo: boolean;
  creditos: number;
  limiteNoAr?: number | null;
  primeiraGratis?: boolean;
}): { texto: string; plano: boolean } {
  if (d.mensalAtivo) {
    return {
      texto:
        d.limiteNoAr == null
          ? "Plano ilimitado ativo"
          : `Plano de ${d.limiteNoAr} ativo`,
      plano: true,
    };
  }

  if (d.creditos === 0 && d.primeiraGratis) {
    return { texto: "Primeira vaga grátis", plano: false };
  }

  return {
    texto:
      d.creditos === 1
        ? "1 vaga para publicar"
        : `${d.creditos} vagas para publicar`,
    plano: false,
  };
}
