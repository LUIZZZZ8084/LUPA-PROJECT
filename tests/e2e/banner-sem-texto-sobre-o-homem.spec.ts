import { expect, type Page, test } from "@playwright/test";

/**
 * Nenhuma linha do título ou da frase do banner cai sobre o homem (#483).
 *
 * A coluna do texto tinha largura própria (`max-w-md`, 448 px) e a foto ficava
 * colada à direita sem reserva: entre 640 e uns 750 px o texto invadia a foto
 * (a 642 px ele ia até 473 px e a foto começava em 371), e em celular pequeno
 * a mesma coisa. Na tela era a frase de apoio passando por baixo do ombro,
 * em cinza sobre a camisa escura, quase ilegível.
 *
 * **Mede-se pelos pixels da foto, e não pela caixa dela.** A imagem tem o
 * canto de cima à esquerda transparente (o homem está à direita e embaixo),
 * então duas caixas que se tocam não querem dizer que o texto cobre o homem.
 * O teste desenha a foto exatamente como aparece, e para cada linha de texto
 * do `h1` e da frase conta os pontos opacos (o homem) que ficam sob ela.
 */
const SEM_SESSAO = { cookies: [], origins: [] };

/** De celular pequeno a tela larga, com a borda de cada ponto de quebra. */
const LARGURAS = [
  320, 360, 390, 412, 600, 639, 640, 660, 700, 740, 768, 820, 900, 1023, 1024,
  1100, 1280,
];

type Medida = {
  pontosSobreOHomem: number;
  linhas: number;
  texto: string;
  /** Quantos pixels o texto passa do pé do fundo do banner (0 se cabe). */
  vazaPorBaixo: number;
};

/** Quantos pontos do homem ficam sob as linhas de texto do banner. */
async function textoSobreOHomem(page: Page): Promise<Medida> {
  return page.evaluate(async () => {
    const img = document.querySelector<HTMLImageElement>(
      'img[src*="trabalhador"]',
    );
    if (!img) throw new Error("foto do banner não encontrada");
    await img.decode();

    const caixa = img.getBoundingClientRect();
    const largura = Math.max(1, Math.round(caixa.width));
    const altura = Math.max(1, Math.round(caixa.height));

    // A foto como aparece: o mesmo arquivo, no tamanho em que está na tela.
    const resposta = await fetch(img.currentSrc);
    const imagem = await createImageBitmap(await resposta.blob());
    const tela = new OffscreenCanvas(largura, altura);
    const contexto = tela.getContext("2d", { willReadFrequently: true });
    if (!contexto) throw new Error("sem canvas");
    contexto.drawImage(imagem, 0, 0, largura, altura);
    const pixels = contexto.getImageData(0, 0, largura, altura).data;
    const opaco = (x: number, y: number) => {
      const ix = Math.floor(x - caixa.left);
      const iy = Math.floor(y - caixa.top);
      if (ix < 0 || iy < 0 || ix >= largura || iy >= altura) return false;
      return pixels[(iy * largura + ix) * 4 + 3] > 128;
    };

    const banner = img.closest("section");
    const alvos = [
      banner?.querySelector("h1"),
      banner?.querySelector("h1 + p"),
    ].filter((e): e is Element => Boolean(e));

    const fundo = banner
      ?.querySelector("[data-fundo-do-banner]")
      ?.getBoundingClientRect();
    let pontos = 0;
    let linhas = 0;
    let maisBaixo = 0;
    for (const alvo of alvos) {
      const faixa = document.createRange();
      faixa.selectNodeContents(alvo);
      for (const r of faixa.getClientRects()) {
        if (r.width < 2 || r.height < 2) continue;
        linhas++;
        maisBaixo = Math.max(maisBaixo, r.bottom);
        for (let x = r.left; x < r.right; x += 3) {
          for (let y = r.top; y < r.bottom; y += 3) {
            if (opaco(x, y)) pontos++;
          }
        }
      }
    }
    return {
      pontosSobreOHomem: pontos,
      linhas,
      texto: alvos.map((a) => a.textContent?.slice(0, 20)).join(" | "),
      vazaPorBaixo: fundo
        ? Math.max(0, Math.round(maisBaixo - fundo.bottom))
        : 0,
    };
  });
}

test.describe("banner da home: texto e foto", () => {
  test.use({ storageState: SEM_SESSAO });

  test("em nenhuma largura o texto cai sobre o homem", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const invadidas: string[] = [];
    const vazando: string[] = [];
    for (const largura of LARGURAS) {
      await page.setViewportSize({ width: largura, height: 900 });
      await page.waitForTimeout(250);
      const m = await textoSobreOHomem(page);
      // Garante que o teste mediu de verdade: o banner tem linhas de texto.
      expect(m.linhas, `linhas do banner a ${largura} px`).toBeGreaterThan(1);
      if (m.vazaPorBaixo > 0) {
        vazando.push(
          `${largura} px: o texto passa ${m.vazaPorBaixo} px do pé do banner`,
        );
      }
      if (m.pontosSobreOHomem > 0) {
        invadidas.push(
          `${largura} px: ${m.pontosSobreOHomem} pontos sobre o homem`,
        );
      }
    }

    expect(invadidas).toEqual([]);
    // O remédio para o texto cobrir o homem não pode ser empurrar o texto para
    // fora do banner: uma coluna mais estreita faz mais linhas.
    expect(vazando).toEqual([]);
  });
});
