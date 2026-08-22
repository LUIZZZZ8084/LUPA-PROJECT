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
import { beforeEach, describe, expect, it, vi } from "vitest";

const storage = vi.hoisted(() => ({
  uploads: [] as { balde: string; caminho: string; opcoes: unknown }[],
  remocoes: [] as { balde: string; caminhos: string[] }[],
  erroUpload: null as { message: string } | null,
  erroAssinatura: null as { message: string } | null,
}));

vi.mock("@/lib/supabase/service", () => ({
  temChaveDeServico: true,
  clienteDeServico: () => ({
    storage: {
      from: (balde: string) => ({
        upload: async (caminho: string, _f: unknown, opcoes: unknown) => {
          storage.uploads.push({ balde, caminho, opcoes });
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

const { enviarArquivo, removerArquivo, urlAssinada } = await import(
  "@/server/arquivos/servico"
);
const { ehAppError } = await import("@/server/errors");

const ID = "11111111-1111-4111-8111-000000000001";

function arquivo(tipo: string, bytes: number) {
  return new File([new Uint8Array(bytes)], "qualquer", { type: tipo });
}

beforeEach(() => {
  storage.uploads.length = 0;
  storage.remocoes.length = 0;
  storage.erroUpload = null;
  storage.erroAssinatura = null;
});

describe("envio", () => {
  it("foto vai para o bucket público, na pasta de avatar", async () => {
    await enviarArquivo(ID, "avatar", arquivo("image/jpeg", 100));

    expect(storage.uploads[0].balde).toBe("avatares");
    expect(storage.uploads[0].caminho).toBe(`avatar/${ID}.jpg`);
  });

  it("logo divide o bucket com a foto, em pasta própria", async () => {
    await enviarArquivo(ID, "logo", arquivo("image/png", 100));

    expect(storage.uploads[0].balde).toBe("avatares");
    expect(storage.uploads[0].caminho).toBe(`logo/${ID}.png`);
  });

  it("currículo vai para o bucket privado", async () => {
    await enviarArquivo(ID, "curriculo", arquivo("application/pdf", 100));
    expect(storage.uploads[0].balde).toBe("curriculos");
  });

  /** Caminho fixo por pessoa: sem sobrescrever, viraria depósito. */
  it("sobrescreve o arquivo anterior", async () => {
    await enviarArquivo(ID, "avatar", arquivo("image/jpeg", 100));
    expect(storage.uploads[0].opcoes).toMatchObject({ upsert: true });
  });

  /**
   * Sem a marca de tempo, trocar a foto não muda a URL e o navegador
   * continua mostrando a antiga do cache — a pessoa conclui que falhou.
   */
  it("a URL pública muda a cada envio", async () => {
    const a = await enviarArquivo(ID, "avatar", arquivo("image/jpeg", 100));
    expect(a.referencia).toContain(`avatares/avatar/${ID}.jpg`);
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

    await expect(
      enviarArquivo(ID, "avatar", arquivo("image/jpeg", 100)),
    ).rejects.toSatisfy((e) => ehAppError(e) && e.codigo === "indisponivel");
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
