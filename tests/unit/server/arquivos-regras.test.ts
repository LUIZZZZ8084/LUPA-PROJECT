/**
 * @vitest-environment node
 *
 * O `accept` de um `<input type="file">` é sugestão ao navegador, não
 * garantia: quem posta direto na action manda o que quiser. Estas regras
 * existem para valer no servidor, e por isso são testadas sem rede.
 */
import { describe, expect, it } from "vitest";
import {
  caminhoDoArquivo,
  conferirArquivo,
  type Especie,
  REGRAS,
} from "@/server/arquivos/regras";

const ID = "11111111-1111-4111-8111-000000000001";

function arquivo(type: string, size: number) {
  return { type, size };
}

describe("o que se aceita", () => {
  it("imagem no formato e tamanho certos passa", () => {
    expect(
      conferirArquivo(arquivo("image/jpeg", 500_000), "avatar"),
    ).toBeNull();
    expect(conferirArquivo(arquivo("image/png", 1000), "logo")).toBeNull();
  });

  it("PDF passa no currículo", () => {
    expect(
      conferirArquivo(arquivo("application/pdf", 1_000_000), "curriculo"),
    ).toBeNull();
  });

  /**
   * PDF renomeado para `.jpg` chega com o tipo real; e mesmo que o tipo
   * fosse forjado, o bucket não executa nada. O que esta regra evita é o
   * caso comum: alguém mandando o arquivo errado no campo errado.
   */
  it("PDF no campo de foto é recusado", () => {
    const r = conferirArquivo(arquivo("application/pdf", 1000), "avatar");
    expect(r?.motivo).toBe("tipo");
    expect(r?.mensagem).toContain("JPG");
  });

  it("imagem no campo de currículo é recusada", () => {
    expect(
      conferirArquivo(arquivo("image/jpeg", 1000), "curriculo")?.motivo,
    ).toBe("tipo");
  });

  it("executável é recusado", () => {
    expect(
      conferirArquivo(arquivo("application/x-msdownload", 1000), "avatar")
        ?.motivo,
    ).toBe("tipo");
  });

  it("SVG é recusado, apesar de ser imagem", () => {
    // SVG carrega script; num bucket público seria XSS servido do domínio.
    expect(
      conferirArquivo(arquivo("image/svg+xml", 1000), "avatar")?.motivo,
    ).toBe("tipo");
  });
});

describe("limites de tamanho", () => {
  it("imagem acima de 2 MB é recusada", () => {
    const r = conferirArquivo(arquivo("image/jpeg", 3 * 1024 * 1024), "avatar");
    expect(r?.motivo).toBe("tamanho");
  });

  /** A mensagem diz o que veio e o que cabia; "inválido" faria repetir. */
  it("a recusa por tamanho diz os dois números", () => {
    const r = conferirArquivo(arquivo("image/jpeg", 3 * 1024 * 1024), "avatar");
    expect(r?.mensagem).toContain("3 MB");
    expect(r?.mensagem).toContain("2 MB");
  });

  it("exatamente no limite passa", () => {
    expect(
      conferirArquivo(arquivo("image/jpeg", 2 * 1024 * 1024), "avatar"),
    ).toBeNull();
  });

  it("currículo aceita mais que imagem", () => {
    expect(
      conferirArquivo(arquivo("application/pdf", 4 * 1024 * 1024), "curriculo"),
    ).toBeNull();
  });

  it("arquivo vazio é recusado antes de qualquer outra coisa", () => {
    expect(conferirArquivo(arquivo("image/jpeg", 0), "avatar")?.motivo).toBe(
      "vazio",
    );
  });
});

describe("onde o arquivo é gravado", () => {
  /**
   * O caminho vem do id da sessão e de uma tabela fechada de extensões.
   * Nome vindo do cliente permitiria `../` para escapar da pasta, ou o id
   * de outra pessoa para sobrescrever o arquivo dela.
   */
  it("o caminho é derivado do id de quem envia", () => {
    expect(caminhoDoArquivo(ID, "avatar", "image/jpeg")).toBe(
      `avatar/${ID}.jpg`,
    );
    expect(caminhoDoArquivo(ID, "logo", "image/png")).toBe(`logo/${ID}.png`);
    expect(caminhoDoArquivo(ID, "curriculo", "application/pdf")).toBe(
      `curriculo/${ID}.pdf`,
    );
  });

  it("foto e logo não colidem, mesmo no mesmo bucket", () => {
    const foto = caminhoDoArquivo(ID, "avatar", "image/jpeg");
    const logo = caminhoDoArquivo(ID, "logo", "image/jpeg");
    expect(foto).not.toBe(logo);
    expect(REGRAS.avatar.balde).toBe(REGRAS.logo.balde);
  });

  /** Caminho fixo por pessoa: trocar substitui, não acumula. */
  it("o mesmo tipo sempre dá o mesmo caminho", () => {
    expect(caminhoDoArquivo(ID, "avatar", "image/jpeg")).toBe(
      caminhoDoArquivo(ID, "avatar", "image/jpeg"),
    );
  });

  it("tipo desconhecido não vira caminho", () => {
    expect(() => caminhoDoArquivo(ID, "avatar", "image/gif")).toThrow();
  });
});

describe("privacidade dos buckets", () => {
  /**
   * O currículo é privado pela mesma razão do currículo em texto: nem todo
   * mundo quer que o patrão atual descubra que está procurando emprego, e
   * essa informação pode custar o emprego que a pessoa ainda tem.
   */
  it("currículo nunca é público", () => {
    expect(REGRAS.curriculo.publico).toBe(false);
  });

  it("foto e logo são públicas — aparecem na busca", () => {
    expect(REGRAS.avatar.publico).toBe(true);
    expect(REGRAS.logo.publico).toBe(true);
  });

  it.each(Object.keys(REGRAS) as Especie[])(
    "%s tem limite e formatos declarados",
    (especie) => {
      const r = REGRAS[especie];
      expect(r.limiteBytes).toBeGreaterThan(0);
      expect(r.tiposAceitos.length).toBeGreaterThan(0);
      expect(r.descricao).toBeTruthy();
    },
  );
});
