/**
 * @vitest-environment node
 *
 * A foto é reduzida antes de ir para o Storage (#283).
 *
 * Tudo aqui usa imagem de verdade, gerada pelo próprio `sharp`: um teste de
 * redução com bytes inventados passaria sem decodificar nada, que é
 * justamente a metade do que esta função existe para garantir.
 */
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import {
  formatoDaImagem,
  ImagemIlegivel,
  reduzirImagem,
  TIPO_REDUZIDO,
} from "@/server/arquivos/imagem";

/** Ruído, para o JPEG não comprimir trivialmente como uma cor lisa. */
async function fotoDeCelular(largura: number, altura: number) {
  return new Uint8Array(
    await sharp({
      create: {
        width: largura,
        height: altura,
        channels: 3,
        background: "#7a9",
        noise: { type: "gaussian", mean: 128, sigma: 40 },
      },
    })
      .jpeg({ quality: 92 })
      .toBuffer(),
  );
}

async function medir(bytes: Uint8Array) {
  return sharp(bytes).metadata();
}

/**
 * Se o EXIF tem um diretório de GPS: a tag 0x8825 no primeiro IFD.
 *
 * Lê a estrutura, e não procura os bytes soltos: a sequência 0x88 0x25
 * aparece por acaso no meio de outros dados, e uma busca simples acusou
 * GPS em fotos de produção que não tinham nenhum.
 */
function temGps(exif: Buffer | undefined): boolean {
  if (!exif) return false;
  const o = exif.toString("latin1", 0, 6) === "Exif\0\0" ? 6 : 0;
  const le = exif.toString("latin1", o, o + 2) === "II";
  const u16 = (p: number) =>
    le ? exif.readUInt16LE(o + p) : exif.readUInt16BE(o + p);
  const u32 = (p: number) =>
    le ? exif.readUInt32LE(o + p) : exif.readUInt32BE(o + p);
  const ifd0 = u32(4);
  for (let i = 0; i < u16(ifd0); i++) {
    if (u16(ifd0 + 2 + i * 12) === 0x8825) return true;
  }
  return false;
}

describe("redução da foto", () => {
  it("foto do feed cai para no máximo 1600 px, em WebP", async () => {
    const original = await fotoDeCelular(3200, 2400);
    const reduzida = await reduzirImagem(original, "publicacao");
    const m = await medir(reduzida);

    expect(TIPO_REDUZIDO).toBe("image/webp");
    expect(m.format).toBe("webp");
    expect(Math.max(m.width ?? 0, m.height ?? 0)).toBe(1600);
    // A proporção se mantém: 4:3 continua 4:3.
    expect(m.width).toBe(1600);
    expect(m.height).toBe(1200);
    /*
     * O ponto da mudança. O ruído é o pior caso para qualquer compressor,
     * e mesmo assim o arquivo cai a uma fração do original.
     */
    expect(reduzida.byteLength).toBeLessThan(original.byteLength / 3);
  });

  it("foto de perfil e logo caem para 512 px", async () => {
    const original = await fotoDeCelular(2000, 2000);
    for (const especie of ["avatar", "logo"] as const) {
      const m = await medir(await reduzirImagem(original, especie));
      expect(m.width).toBe(512);
      expect(m.height).toBe(512);
    }
  });

  /** Ampliar foto pequena só gastaria espaço, sem ganhar nitidez. */
  it("foto pequena não é ampliada", async () => {
    const m = await medir(
      await reduzirImagem(await fotoDeCelular(300, 200), "publicacao"),
    );
    expect(m.width).toBe(300);
    expect(m.height).toBe(200);
  });
});

describe("metadados", () => {
  /**
   * O GPS da foto de celular é o motivo mais sério desta mudança: os
   * buckets de foto são públicos, e o original era servido com ele.
   */
  it("EXIF e GPS saem", async () => {
    const comGps = new Uint8Array(
      await sharp(await fotoDeCelular(800, 600))
        .withExif({
          IFD0: { Copyright: "marca-de-teste-lupa" },
          IFD3: { GPSLatitudeRef: "S", GPSLongitudeRef: "W" },
        })
        .jpeg()
        .toBuffer(),
    );
    // Controle: a entrada tem mesmo o metadado que o teste diz tirar.
    expect(temGps((await medir(comGps)).exif)).toBe(true);
    // E o leitor não acusa GPS onde não há.
    const semGps = await sharp(await fotoDeCelular(80, 60))
      .withExif({ IFD0: { Copyright: "x" } })
      .jpeg()
      .toBuffer();
    expect(temGps((await medir(semGps)).exif)).toBe(false);
    expect(Buffer.from(comGps).includes("marca-de-teste-lupa")).toBe(true);

    const reduzida = await reduzirImagem(comGps, "publicacao");

    expect((await medir(reduzida)).exif).toBeUndefined();
    expect(Buffer.from(reduzida).includes("marca-de-teste-lupa")).toBe(false);
  });

  /**
   * O celular em pé guarda os pixels deitados e um aviso de "gire 90°" no
   * EXIF. Tirar o EXIF sem aplicar a rotação deixaria a foto deitada.
   */
  it("a orientação do celular é aplicada antes de o EXIF sair", async () => {
    const deitada = new Uint8Array(
      await sharp(await fotoDeCelular(400, 200))
        .withMetadata({ orientation: 6 })
        .jpeg()
        .toBuffer(),
    );

    const m = await medir(await reduzirImagem(deitada, "publicacao"));

    expect(m.width).toBe(200);
    expect(m.height).toBe(400);
    expect(m.orientation).toBeUndefined();
  });
});

describe("conteúdo", () => {
  /** Logo com fundo transparente continua transparente. */
  it("transparência sobrevive", async () => {
    const png = new Uint8Array(
      await sharp({
        create: {
          width: 200,
          height: 200,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        },
      })
        .png()
        .toBuffer(),
    );

    const m = await medir(await reduzirImagem(png, "logo"));
    expect(m.hasAlpha).toBe(true);
  });

  /**
   * O tipo declarado é palpite do cliente. Decodificar é o que prova que
   * o arquivo é imagem — um PDF renomeado para .jpg não passa.
   */
  it("o que não é imagem é recusado", async () => {
    const falso = new TextEncoder().encode("%PDF-1.7 isto não é uma foto");
    await expect(reduzirImagem(falso, "avatar")).rejects.toBeInstanceOf(
      ImagemIlegivel,
    );
  });
});

/**
 * O tipo declarado é palpite, e o `sharp` lê mais formatos do que o app
 * aceita (#368). O que se cobra aqui é a assinatura real do arquivo, antes
 * de qualquer decodificador.
 */
describe("o formato de verdade", () => {
  async function quadrado() {
    return sharp({
      create: { width: 40, height: 40, channels: 3, background: "#3f6810" },
    });
  }

  const SVG = new TextEncoder().encode(
    '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64">' +
      '<rect width="64" height="64" fill="#3f6810"/></svg>',
  );

  it("JPEG, PNG e WebP de verdade são reconhecidos e reduzidos", async () => {
    const por = {
      jpeg: new Uint8Array(await (await quadrado()).jpeg().toBuffer()),
      png: new Uint8Array(await (await quadrado()).png().toBuffer()),
      webp: new Uint8Array(await (await quadrado()).webp().toBuffer()),
    } as const;

    for (const [formato, bytes] of Object.entries(por)) {
      expect(formatoDaImagem(bytes), formato).toBe(formato);
      const saida = await reduzirImagem(bytes, "avatar");
      expect((await medir(saida)).format, formato).toBe("webp");
    }
  });

  /**
   * O defeito: um SVG enviado como `image/png` passava pela checagem de
   * tipo, o `sharp` o decodificava, e ele chegava à librsvg. O teste prova
   * os dois lados — que `sharp` o leria (senão o teste não vigia nada) e
   * que `reduzirImagem` o recusa.
   */
  it("SVG disfarçado de foto é recusado, ainda que o sharp o leia", async () => {
    expect((await medir(SVG)).format).toBe("svg");

    expect(formatoDaImagem(SVG)).toBeNull();
    await expect(reduzirImagem(SVG, "avatar")).rejects.toBeInstanceOf(
      ImagemIlegivel,
    );
  });

  it.each([
    ["GIF", async () => (await quadrado()).gif().toBuffer()],
    ["TIFF", async () => (await quadrado()).tiff().toBuffer()],
  ] as const)(
    "%s, que o sharp lê e o app não aceita, é recusado",
    async (_nome, gerar) => {
      const bytes = new Uint8Array(await gerar());

      expect(formatoDaImagem(bytes)).toBeNull();
      await expect(reduzirImagem(bytes, "logo")).rejects.toBeInstanceOf(
        ImagemIlegivel,
      );
    },
  );

  it("arquivo vazio, curto ou RIFF que não é WebP é recusado", () => {
    expect(formatoDaImagem(new Uint8Array())).toBeNull();
    expect(formatoDaImagem(new Uint8Array([0xff, 0xd8]))).toBeNull();
    // RIFF de áudio (WAVE): mesmo começo do WebP, outro arquivo.
    const wav = new TextEncoder().encode("RIFF    WAVEfmt ");
    expect(formatoDaImagem(wav)).toBeNull();
  });
});

/**
 * Arquivo com a assinatura de um formato aceito e um SVG logo depois (#370).
 *
 * A conferência de bytes do #368 barra o disfarce comum, mas deixa passar
 * quem começa certo e esconde o resto. Medido com o `sharp` 0.35.5, isso não
 * chega ao leitor de SVG: o libvips escolhe o leitor pela assinatura do
 * começo, o do JPEG, do PNG ou do WebP recebe o arquivo e o recusa por
 * cabeçalho corrompido.
 *
 * Essa proteção não é nossa, é do libvips, e pode mudar numa atualização do
 * `sharp`. Por isso há dois testes por arquivo: o primeiro vigia o `sharp`
 * sozinho — se ele um dia passar a ler SVG escondido, reprova aqui, na CI —,
 * e o segundo vigia `reduzirImagem`.
 */
describe("assinatura aceita com SVG escondido", () => {
  const SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64">' +
    '<rect width="64" height="64" fill="#3f6810"/></svg>';

  function juntar(...partes: (string | number[])[]) {
    return new Uint8Array(
      Buffer.concat(
        partes.map((p) =>
          typeof p === "string" ? Buffer.from(p, "latin1") : Buffer.from(p),
        ),
      ),
    );
  }

  const CASOS = [
    ["assinatura de JPEG", juntar([0xff, 0xd8, 0xff, 0xe0], SVG)],
    [
      "assinatura de PNG",
      juntar([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], SVG),
    ],
    ["assinatura de WebP", juntar("RIFF", [0, 0, 0, 0], "WEBP", SVG)],
    [
      "assinatura de JPEG e 1.000 bytes de espaço antes do SVG",
      juntar([0xff, 0xd8, 0xff, 0xe0], " ".repeat(1000), SVG),
    ],
  ] as const;

  it("o ponto de partida: o SVG puro é lido pelo sharp", async () => {
    // Sem isto os testes abaixo não vigiam nada: se o sharp deixasse de ler
    // SVG, todo arquivo "recusado" seria recusado por outro motivo.
    expect((await medir(juntar(SVG))).format).toBe("svg");
  });

  it.each(CASOS)(
    "%s: o sharp recusa, e não lê como SVG",
    async (_nome, bytes) => {
      await expect(sharp(bytes).metadata()).rejects.toThrow();
      await expect(
        sharp(bytes).resize({ width: 32 }).webp().toBuffer(),
      ).rejects.toThrow();
    },
  );

  it.each(CASOS)(
    "%s: reduzirImagem recusa com ImagemIlegivel",
    async (_nome, bytes) => {
      await expect(reduzirImagem(bytes, "avatar")).rejects.toBeInstanceOf(
        ImagemIlegivel,
      );
    },
  );
});
