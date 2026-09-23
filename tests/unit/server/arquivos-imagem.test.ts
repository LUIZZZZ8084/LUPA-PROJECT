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

/** Se o bloco de EXIF aponta para um diretório de GPS (tag 0x8825). */
function temGps(exif: Buffer | undefined): boolean {
  if (!exif) return false;
  return (
    exif.includes(Buffer.from([0x88, 0x25])) ||
    exif.includes(Buffer.from([0x25, 0x88]))
  );
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
