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

export class ImagemIlegivel extends Error {
  constructor(causa: unknown) {
    super("o arquivo não pôde ser lido como imagem", { cause: causa });
    this.name = "ImagemIlegivel";
  }
}

/**
 * O arquivo começa como JPEG, PNG ou WebP? Pela assinatura, não pelo tipo
 * declarado (#362).
 *
 * O `sharp` detecta o formato pelo conteúdo, e o que ele sabe ler vai além
 * dos três que a Lupa aceita — SVG, GIF, TIFF, HEIF. `conferirArquivo` olha o
 * tipo que o navegador declara, e quem declara é quem envia: um SVG com
 * `image/png` chegaria ao decodificador. A assinatura fecha isso antes de o
 * arquivo tocar em biblioteca nativa, e o que nunca é lido não pode ser
 * explorado por um aviso novo na biblioteca que o lê.
 */
export function ehJpegPngOuWebp(b: Uint8Array): boolean {
  const jpeg = b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  const png =
    b[0] === 0x89 &&
    b[1] === 0x50 &&
    b[2] === 0x4e &&
    b[3] === 0x47 &&
    b[4] === 0x0d &&
    b[5] === 0x0a &&
    b[6] === 0x1a &&
    b[7] === 0x0a;
  const webp =
    b[0] === 0x52 && // RIFF
    b[1] === 0x49 &&
    b[2] === 0x46 &&
    b[3] === 0x46 &&
    b[8] === 0x57 && // WEBP
    b[9] === 0x45 &&
    b[10] === 0x42 &&
    b[11] === 0x50;
  return jpeg || png || webp;
}

export async function reduzirImagem(
  bytes: Uint8Array,
  especie: Exclude<Especie, "curriculo">,
): Promise<Uint8Array> {
  const lado = MAIOR_LADO[especie];

  if (!ehJpegPngOuWebp(bytes)) {
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
