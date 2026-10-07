import "server-only";

import type { Especie } from "./regras";

/**
 * Reduz a foto antes de ela ir para o Storage (#283).
 *
 * A #268 já reduzia a foto **na entrega**: o otimizador do Next manda ao
 * celular um WebP do tamanho da tela. O arquivo guardado continuava sendo o
 * que a pessoa enviou — 1 a 2 MB por foto, no 1 GB do plano gratuito. Na
 * média medida em produção, cabiam umas 800 fotos.
 *
 * Reencodar aqui resolve três coisas de uma vez:
 *
 * - **Espaço.** Uma foto de celular de 1,5 MB vira umas centenas de KB, e
 *   o otimizador continua entregando a versão do tamanho da tela a partir
 *   dela. Na tela, nada muda.
 * - **Localização.** Foto de celular carrega EXIF, e com frequência o GPS
 *   de onde foi tirada. Os buckets de foto são públicos, e a URL do
 *   original aparece no HTML, como parâmetro do otimizador. O `sharp` não
 *   copia metadado nenhum para a saída a menos que se peça — e aqui não se
 *   pede.
 * - **Conteúdo.** `conferirArquivo` confere o tipo **declarado**. Decodificar
 *   é o que prova que o arquivo é uma imagem de verdade.
 */

/**
 * O maior lado, em pixels, depois de reduzir.
 *
 * Perfil e logo aparecem em no máximo 96 px, então 512 cobre tela de
 * densidade alta com folga. A foto do feed abre em tela cheia quando tocada,
 * e 1600 é mais do que a largura de qualquer celular em pixels físicos.
 */
const MAIOR_LADO: Record<Exclude<Especie, "curriculo">, number> = {
  avatar: 512,
  logo: 512,
  publicacao: 1600,
};

/**
 * Qualidade do WebP.
 *
 * 80 é onde a diferença para o original deixa de ser visível numa tela de
 * celular, e o arquivo já caiu para uma fração do JPEG da câmera.
 */
const QUALIDADE = 80;

export const TIPO_REDUZIDO = "image/webp";

/**
 * O formato de verdade, pelos primeiros bytes (#368).
 *
 * `conferirArquivo` olha o tipo que o navegador **declarou**, e qualquer
 * cliente declara o que quiser. O `sharp`, por sua vez, decide o formato
 * pelo conteúdo, e lê muito mais do que o app aceita — SVG entre eles, que
 * um envio de foto não tem por que levar à librsvg. Este é o mesmo cuidado
 * que o currículo já tem com `%PDF-`: conferir a assinatura antes de
 * entregar o arquivo a uma biblioteca.
 *
 * Só JPEG, PNG e WebP, que é o que `tiposAceitos` promete. O resto volta
 * `null`, e `reduzirImagem` recusa sem chamar o `sharp`.
 */
export function formatoDaImagem(
  bytes: Uint8Array,
): "jpeg" | "png" | "webp" | null {
  const comeca = (...assinatura: number[]) =>
    bytes.length >= assinatura.length &&
    assinatura.every((b, i) => bytes[i] === b);

  if (comeca(0xff, 0xd8, 0xff)) return "jpeg";
  if (comeca(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "png";

  // WebP: "RIFF", o tamanho em 4 bytes, e "WEBP".
  const ehRiff = comeca(0x52, 0x49, 0x46, 0x46);
  const ehWebp =
    bytes.length >= 12 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50;
  if (ehRiff && ehWebp) return "webp";

  return null;
}

export class ImagemIlegivel extends Error {
  constructor(causa: unknown) {
    super("o arquivo não pôde ser lido como imagem", { cause: causa });
    this.name = "ImagemIlegivel";
  }
}

export async function reduzirImagem(
  bytes: Uint8Array,
  especie: Exclude<Especie, "curriculo">,
): Promise<Uint8Array> {
  const lado = MAIOR_LADO[especie];

  /*
   * Antes de carregar o `sharp`, e não depois: o que não é JPEG, PNG ou
   * WebP não deve chegar a nenhum decodificador, e recusar aqui não custa
   * nem o carregamento do binário nativo.
   */
  if (!formatoDaImagem(bytes)) {
    throw new ImagemIlegivel(new Error("formato fora de JPEG, PNG e WebP"));
  }

  /*
   * Carregado só aqui, e não no topo do arquivo.
   *
   * O `sharp` é binário nativo. Este módulo entra no grafo das actions de
   * perfil, e um import no topo que falhasse ao carregar derrubaria a
   * edição de perfil inteira — telefone, redes, tudo —, não só o envio
   * de foto. Carregado aqui, o pior caso é o envio falhar com mensagem e
   * aparecer no Sentry.
   */
  const { default: sharp } = await import("sharp");

  try {
    const saida = await sharp(bytes)
      /*
       * Aplica a orientação do EXIF antes de o EXIF sair. Sem isto, a foto
       * tirada com o celular em pé fica deitada: o arquivo guarda os pixels
       * de lado e diz, no metadado, para girar.
       */
      .rotate()
      .resize({
        width: lado,
        height: lado,
        fit: "inside",
        // Foto pequena fica do tamanho que veio: ampliar só gasta espaço.
        withoutEnlargement: true,
      })
      .webp({ quality: QUALIDADE })
      .toBuffer();

    return new Uint8Array(saida);
  } catch (erro) {
    throw new ImagemIlegivel(erro);
  }
}
