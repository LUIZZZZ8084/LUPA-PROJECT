/**
 * O que se aceita receber, e por quê.
 *
 * Estas regras vivem separadas do envio porque são a parte que precisa ser
 * verificada sem rede: o `accept` de um `<input type="file">` é sugestão ao
 * navegador, não garantia. Quem posta direto na action manda o que quiser.
 */

export type Especie = "avatar" | "logo" | "curriculo";

export interface Regra {
  /** Bucket de destino. */
  balde: "avatares" | "curriculos";
  /** Pasta dentro do bucket, para separar o que é foto do que é logo. */
  pasta: string;
  /** Público significa servido por URL fixa; privado exige URL assinada. */
  publico: boolean;
  tiposAceitos: readonly string[];
  extensoes: Readonly<Record<string, string>>;
  limiteBytes: number;
  /** Como explicar o limite para quem está enviando. */
  descricao: string;
}

/**
 * Limites pensados para quem envia de celular em dado móvel contado.
 *
 * Dois megabytes numa foto de perfil já é generoso: a maior exibição é um
 * avatar de 96 pixels. Cinco no currículo cabe um PDF de várias páginas com
 * folga. Limites maiores não melhoram nada visível e viram custo de banda
 * para quem menos pode pagar.
 */
const IMAGEM = {
  tiposAceitos: ["image/jpeg", "image/png", "image/webp"],
  extensoes: {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  },
  limiteBytes: 2 * 1024 * 1024,
  descricao: "JPG, PNG ou WEBP, até 2 MB",
} as const;

export const REGRAS: Readonly<Record<Especie, Regra>> = {
  avatar: { balde: "avatares", pasta: "avatar", publico: true, ...IMAGEM },
  logo: { balde: "avatares", pasta: "logo", publico: true, ...IMAGEM },
  curriculo: {
    balde: "curriculos",
    pasta: "curriculo",
    /*
     * Privado pela mesma razão do currículo em texto: nem todo mundo quer
     * que o patrão atual descubra que está procurando emprego, e essa
     * informação pode custar o emprego que a pessoa ainda tem. O acesso
     * passa pelo servidor, que gera URL assinada de curta duração.
     */
    publico: false,
    tiposAceitos: ["application/pdf"],
    extensoes: { "application/pdf": "pdf" },
    limiteBytes: 5 * 1024 * 1024,
    descricao: "PDF, até 5 MB",
  },
};

export interface Recusa {
  motivo: "tipo" | "tamanho" | "vazio";
  mensagem: string;
}

function emMegabytes(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(bytes % (1024 * 1024) === 0 ? 0 : 1)} MB`;
}

/**
 * Confere tipo e tamanho antes de qualquer coisa sair da máquina.
 *
 * A mensagem diz o que foi recebido e o que se esperava. "Arquivo
 * inválido" faz a pessoa tentar de novo com o mesmo arquivo.
 */
export function conferirArquivo(
  arquivo: { type: string; size: number },
  especie: Especie,
): Recusa | null {
  const regra = REGRAS[especie];

  if (arquivo.size === 0) {
    return { motivo: "vazio", mensagem: "O arquivo está vazio." };
  }

  if (!regra.tiposAceitos.includes(arquivo.type)) {
    return {
      motivo: "tipo",
      mensagem: `Formato não aceito. Envie ${regra.descricao}.`,
    };
  }

  if (arquivo.size > regra.limiteBytes) {
    return {
      motivo: "tamanho",
      mensagem: `O arquivo tem ${emMegabytes(arquivo.size)} e o limite é ${emMegabytes(regra.limiteBytes)}.`,
    };
  }

  return null;
}

/**
 * Onde o arquivo é gravado.
 *
 * O caminho vem do id de quem está enviando e do tipo do arquivo — nunca do
 * nome que chegou. Nome vindo do cliente permite `../` para escapar da
 * pasta, ou o id de outra pessoa para sobrescrever o arquivo dela. Aqui não
 * há o que injetar: o id vem da sessão e a extensão, de uma tabela fechada.
 *
 * Um caminho fixo por pessoa também faz a troca substituir o anterior, o
 * que evita o bucket virar depósito de versões antigas que ninguém apaga.
 */
export function caminhoDoArquivo(
  usuarioId: string,
  especie: Especie,
  tipoMime: string,
): string {
  const regra = REGRAS[especie];
  const extensao = regra.extensoes[tipoMime];
  if (!extensao) {
    throw new Error(`tipo sem extensão conhecida: ${tipoMime}`);
  }
  return `${regra.pasta}/${usuarioId}.${extensao}`;
}
