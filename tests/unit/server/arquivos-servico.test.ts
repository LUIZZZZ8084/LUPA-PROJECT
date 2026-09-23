/**
 * @vitest-environment node
 *
 * O envio em si: para qual bucket vai, com que caminho, e o que acontece
 * quando o Storage recusa.
 *
 * Tudo passa pela chave de serviço, no servidor. O navegador nunca fala com
 * o Storage direto — fosse assim, quem pode enviar e para onde viraria
 * responsabilidade de uma policy, e policy errada é silenciosa até alguém
 * sobrescrever o arquivo de outra pessoa.
 */
import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";

const storage = vi.hoisted(() => ({
  uploads: [] as {
    balde: string;
    caminho: string;
    corpo: unknown;
    opcoes: unknown;
  }[],
  remocoes: [] as { balde: string; caminhos: string[] }[],
  erroUpload: null as { message: string } | null,
  erroAssinatura: null as { message: string } | null,
}));

vi.mock("@/lib/supabase/service", () => ({
  temChaveDeServico: true,
  clienteDeServico: () => ({
    storage: {
      from: (balde: string) => ({
        upload: async (caminho: string, corpo: unknown, opcoes: unknown) => {
          storage.uploads.push({ balde, caminho, corpo, opcoes });
          return { error: storage.erroUpload };
        },
        remove: async (caminhos: string[]) => {
          storage.remocoes.push({ balde, caminhos });
          return { error: null };
        },
        getPublicUrl: (caminho: string) => ({
          data: { publicUrl: `https://cdn/${balde}/${caminho}` },
        }),
        createSignedUrl: async (caminho: string) => ({
          data: storage.erroAssinatura
            ? null
            : { signedUrl: `https://cdn/assinada/${caminho}` },
          error: storage.erroAssinatura,
        }),
      }),
    },
  }),
}));

const { enviarArquivo, removerArquivo, removerVersoesAnteriores, urlAssinada } =
  await import("@/server/arquivos/servico");
const { ehAppError } = await import("@/server/errors");

const ID = "11111111-1111-4111-8111-000000000001";

function arquivo(tipo: string, bytes: number) {
  return new File([new Uint8Array(bytes)], "qualquer", { type: tipo });
}

/**
 * Uma foto de verdade (#283): desde que o envio decodifica a imagem para
 * reduzi-la, bytes zerados com `type: image/jpeg` são recusados — como
 * devem ser.
 */
async function foto(tipo: "image/jpeg" | "image/png" = "image/jpeg") {
  const imagem = sharp({
    create: { width: 1200, height: 900, channels: 3, background: "#7a9" },
  });
  const bytes = await (tipo === "image/png"
    ? imagem.png()
    : imagem.jpeg()
  ).toBuffer();
  return new File([new Uint8Array(bytes)], "foto", { type: tipo });
}

beforeEach(() => {
  storage.uploads.length = 0;
  storage.remocoes.length = 0;
  storage.erroUpload = null;
  storage.erroAssinatura = null;
});

describe("envio", () => {
  it("foto vai para o bucket público, na pasta de avatar", async () => {
    await enviarArquivo(ID, "avatar", await foto());

    expect(storage.uploads[0].balde).toBe("avatares");
    expect(storage.uploads[0].caminho).toBe(`avatar/${ID}.webp`);
  });

  it("logo divide o bucket com a foto, em pasta própria", async () => {
    await enviarArquivo(ID, "logo", await foto("image/png"));

    expect(storage.uploads[0].balde).toBe("avatares");
    expect(storage.uploads[0].caminho).toBe(`logo/${ID}.webp`);
  });

  /**
   * O que chega ao bucket é a versão reduzida, não o original (#283). O
   * tamanho e os metadados são conferidos em arquivos-imagem.test.ts;
   * aqui, que é ela quem viaja.
   */
  it("grava a foto reduzida, em WebP", async () => {
    await enviarArquivo(ID, "publicacao", await foto());

    const { corpo, opcoes } = storage.uploads[0];
    expect(opcoes).toMatchObject({ contentType: "image/webp" });
    expect(corpo).toBeInstanceOf(Uint8Array);
    const m = await sharp(corpo as Uint8Array).metadata();
    expect(m.format).toBe("webp");
    expect(m.width).toBe(1200);
  });

  /** O currículo é PDF que a pessoa montou: passa como veio. */
  it("currículo não é reencodado", async () => {
    const pdf = arquivo("application/pdf", 100);
    await enviarArquivo(ID, "curriculo", pdf);

    expect(storage.uploads[0].corpo).toBe(pdf);
    expect(storage.uploads[0].opcoes).toMatchObject({
      contentType: "application/pdf",
    });
  });

  it("currículo vai para o bucket privado", async () => {
    await enviarArquivo(ID, "curriculo", arquivo("application/pdf", 100));
    expect(storage.uploads[0].balde).toBe("curriculos");
  });

  /** Caminho fixo por pessoa: sem sobrescrever, viraria depósito. */
  it("sobrescreve o arquivo anterior", async () => {
    await enviarArquivo(ID, "avatar", await foto());
    expect(storage.uploads[0].opcoes).toMatchObject({ upsert: true });
  });

  /**
   * Sem a marca de tempo, trocar a foto não muda a URL e o navegador
   * continua mostrando a antiga do cache — a pessoa conclui que falhou.
   */
  it("a URL pública muda a cada envio", async () => {
    const a = await enviarArquivo(ID, "avatar", await foto());
    expect(a.referencia).toContain(`avatares/avatar/${ID}.webp`);
    expect(a.referencia).toMatch(/\?v=\d+/);
  });

  /** Privado não tem URL fixa: guarda-se o caminho, o link nasce depois. */
  it("currículo devolve caminho, não URL", async () => {
    const r = await enviarArquivo(
      ID,
      "curriculo",
      arquivo("application/pdf", 1),
    );
    expect(r.referencia).toBe(`curriculo/${ID}.pdf`);
    expect(r.referencia).not.toContain("http");
  });
});

describe("recusa antes de sair da máquina", () => {
  it("tipo errado não chega ao bucket", async () => {
    await expect(
      enviarArquivo(ID, "avatar", arquivo("application/pdf", 100)),
    ).rejects.toSatisfy((e) => ehAppError(e) && e.codigo === "validacao");

    expect(storage.uploads).toEqual([]);
  });

  it("arquivo grande demais não chega ao bucket", async () => {
    await expect(
      enviarArquivo(ID, "avatar", arquivo("image/jpeg", 3 * 1024 * 1024)),
    ).rejects.toSatisfy((e) => ehAppError(e) && e.codigo === "validacao");

    expect(storage.uploads).toEqual([]);
  });

  /** O erro é do campo do arquivo, para aparecer embaixo do seletor. */
  it("a recusa aponta o campo", async () => {
    await expect(
      enviarArquivo(ID, "avatar", arquivo("application/pdf", 100)),
    ).rejects.toSatisfy(
      (e) => ehAppError(e) && e.campos?.[0]?.campo === "arquivo",
    );
  });

  it("falha do Storage vira indisponível, não silêncio", async () => {
    storage.erroUpload = { message: "bucket fora do ar" };

    await expect(enviarArquivo(ID, "avatar", await foto())).rejects.toSatisfy(
      (e) => ehAppError(e) && e.codigo === "indisponivel",
    );
  });

  /**
   * Tipo declarado é palpite do cliente (#283). Um arquivo que diz ser
   * JPEG e não decodifica não chega ao bucket, e o erro aparece embaixo
   * do seletor, dizendo o que fazer.
   */
  it("o que diz ser foto e não é fica de fora", async () => {
    await expect(
      enviarArquivo(ID, "avatar", arquivo("image/jpeg", 100)),
    ).rejects.toSatisfy(
      (e) =>
        ehAppError(e) &&
        e.codigo === "validacao" &&
        e.campos?.[0]?.campo === "arquivo",
    );

    expect(storage.uploads).toEqual([]);
  });
});

describe("remoção", () => {
  /**
   * Remove todas as extensões possíveis: a pessoa pode ter enviado PNG e
   * estar apagando depois de trocar por JPG. Deixar o antigo é pagar por
   * lixo que ninguém alcança.
   */
  it("apaga todas as extensões possíveis daquela espécie", async () => {
    await removerArquivo(ID, "avatar");

    expect(storage.remocoes[0].balde).toBe("avatares");
    expect(storage.remocoes[0].caminhos).toEqual([
      `avatar/${ID}.jpg`,
      `avatar/${ID}.png`,
      `avatar/${ID}.webp`,
    ]);
  });

  /**
   * Desde a #283 toda foto é `.webp`. A foto antiga em `.jpg` ficaria no
   * bucket para sempre, sem nada apontando para ela.
   */
  it("a troca apaga as versões de outras extensões, e só elas", async () => {
    await removerVersoesAnteriores(ID, "avatar", `avatar/${ID}.webp`);

    expect(storage.remocoes[0].caminhos).toEqual([
      `avatar/${ID}.jpg`,
      `avatar/${ID}.png`,
    ]);
  });

  /** Foto do feed tem caminho próprio por envio: não há o que limpar. */
  it("foto do feed não tem versão anterior", async () => {
    await removerVersoesAnteriores(ID, "publicacao", `trabalho/${ID}/x.webp`);
    expect(storage.remocoes).toEqual([]);
  });

  it("currículo remove do bucket privado", async () => {
    await removerArquivo(ID, "curriculo");
    expect(storage.remocoes[0].balde).toBe("curriculos");
  });
});

describe("link assinado", () => {
  it("gera link para o caminho guardado", async () => {
    expect(await urlAssinada(`curriculo/${ID}.pdf`)).toContain("assinada");
  });

  it("sem caminho não há link", async () => {
    expect(await urlAssinada(null)).toBeNull();
  });

  /** Falha ao assinar vira "sem currículo", não tela de erro. */
  it("falha ao assinar devolve null", async () => {
    storage.erroAssinatura = { message: "objeto não encontrado" };
    expect(await urlAssinada(`curriculo/${ID}.pdf`)).toBeNull();
  });
});
