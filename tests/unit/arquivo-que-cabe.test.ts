/**
 * @vitest-environment node
 *
 * O arquivo escolhido cabe no envio, ou a pessoa sabe por que não (#324,
 * #325).
 *
 * Os dois defeitos tinham a mesma raiz: o limite só era conferido no
 * servidor, depois de o arquivo atravessar a rede. A foto de celular era
 * recusada inteira, e o PDF grande era cortado pela Vercel antes de
 * qualquer mensagem nossa existir.
 *
 * A redução de verdade usa canvas e só roda num navegador; aqui ela é
 * injetada, e o que se cobra é a decisão. O caminho no navegador foi
 * conferido à mão, no Edge, com uma foto gerada de 5 MB — ver o PR.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { prepararArquivo } from "@/components/ui/arquivo-que-cabe";
import { REGRAS } from "@/server/arquivos/regras";

const MB = 1024 * 1024;

function arquivo(tamanho: number, tipo: string, nome = "x") {
  return new File([new Uint8Array(tamanho)], nome, { type: tipo });
}

describe("o que acontece com o arquivo escolhido", () => {
  it("dentro do limite, segue como está, sem reduzir", async () => {
    const reduzir = vi.fn();
    const foto = arquivo(MB, "image/jpeg");

    expect(await prepararArquivo(foto, "avatar", reduzir)).toEqual({
      arquivo: foto,
    });
    expect(reduzir).not.toHaveBeenCalled();
  });

  /** O caso da #325: a foto do celular. */
  it("foto acima do limite é reduzida, e a reduzida é que vai", async () => {
    const reduzida = arquivo(400 * 1024, "image/webp", "foto.webp");
    const reduzir = vi.fn(async () => reduzida);

    const r = await prepararArquivo(
      arquivo(5 * MB, "image/jpeg", "foto.jpg"),
      "publicacao",
      reduzir,
    );

    expect(reduzir).toHaveBeenCalledOnce();
    expect(r).toEqual({ arquivo: reduzida });
  });

  it("se não der para reduzir, diz o limite em vez de mandar", async () => {
    const r = await prepararArquivo(
      arquivo(5 * MB, "image/jpeg"),
      "avatar",
      async () => {
        throw new Error("formato que o navegador não lê");
      },
    );

    expect(r).toEqual({ erro: expect.stringMatching(/limite é 2 MB/) });
  });

  it("reduzida e ainda grande também não vai", async () => {
    const r = await prepararArquivo(
      arquivo(5 * MB, "image/jpeg"),
      "logo",
      async () => arquivo(3 * MB, "image/webp"),
    );

    expect("erro" in r).toBe(true);
  });

  /** O caso da #324: PDF não se reduz no navegador. */
  it("PDF acima do limite é recusado antes de sair do aparelho", async () => {
    const reduzir = vi.fn();
    const r = await prepararArquivo(
      arquivo(Math.round(4.8 * MB), "application/pdf"),
      "curriculo",
      reduzir,
    );

    expect(r).toEqual({ erro: expect.stringMatching(/limite é 4 MB/) });
    expect(reduzir).not.toHaveBeenCalled();
  });

  it("formato errado é recusado, sem tentar reduzir", async () => {
    const reduzir = vi.fn();
    const r = await prepararArquivo(
      arquivo(5 * MB, "image/gif"),
      "avatar",
      reduzir,
    );

    expect(r).toEqual({ erro: expect.stringMatching(/Formato não aceito/) });
    expect(reduzir).not.toHaveBeenCalled();
  });
});

/**
 * O limite da plataforma, escrito aqui com a razão.
 *
 * A Vercel recusa corpo acima de 4,5 MB numa função, antes de a action
 * existir: a pessoa vê um erro genérico em inglês, e a nossa mensagem
 * nunca é lida. O currículo prometia 5 MB (#324). Regra nova acima deste
 * número reprova aqui, e não no celular de alguém.
 */
const CORPO_MAXIMO_DA_VERCEL = 4.5 * MB;

describe("os limites cabem na plataforma", () => {
  it.each(Object.entries(REGRAS))(
    "%s cabe no corpo que a Vercel aceita",
    (_, regra) => {
      expect(regra.limiteBytes).toBeLessThan(CORPO_MAXIMO_DA_VERCEL);
    },
  );
});

/**
 * Todo campo de arquivo passa pela conferência.
 *
 * Eram quatro campos, em três arquivos, cada um com o próprio `accept` e o
 * próprio texto de limite escrito à mão. Uma lista assim é a que este
 * projeto já viu envelhecer em silêncio: o campo novo nasce sem a
 * conferência, e a foto do celular volta a ser recusada só nele.
 */
describe("campos de arquivo", () => {
  const SRC = join(process.cwd(), "src");

  function arquivos(dir: string): string[] {
    return readdirSync(dir).flatMap((nome) => {
      const caminho = join(dir, nome);
      if (statSync(caminho).isDirectory()) return arquivos(caminho);
      return nome.endsWith(".tsx") ? [caminho] : [];
    });
  }

  const comCampo = arquivos(SRC)
    .map((caminho) => ({ caminho, fonte: readFileSync(caminho, "utf8") }))
    .filter(({ fonte }) => fonte.includes('type="file"'));

  it("a varredura acha os campos que existem", () => {
    // Controle: se o padrão parar de casar, o teste abaixo passaria vazio.
    expect(comCampo.length).toBeGreaterThanOrEqual(3);
  });

  it("todo campo de arquivo confere o limite antes de enviar", () => {
    const semConferencia = comCampo.flatMap(({ caminho, fonte }) => {
      const campos = fonte.split('type="file"').length - 1;
      const conferidos = fonte.split("onChange={ajustarAoLimite(").length - 1;
      return conferidos >= campos ? [] : [caminho];
    });

    expect(semConferencia).toEqual([]);
  });
});
