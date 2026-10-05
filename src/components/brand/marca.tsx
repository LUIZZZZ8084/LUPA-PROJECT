/**
 * O desenho da marca Lupa, num lugar só (#343).
 *
 * Lupa de aro grosso, cabo para baixo e para a esquerda, e no centro um
 * disco com uma pessoa. A pessoa diz o que a Lupa é — encontrar gente — sem
 * prometer o que o produto não entrega: o desenho anterior, uma lente com
 * um *check*, dizia "verificado", e o produto parou de dizer isso (#237,
 * #243).
 *
 * Este arquivo só tem geometria. As cores chegam por parâmetro, porque quem
 * desenha precisa decidir por conta própria: o app troca de tema, e as
 * imagens geradas em build (`icon.tsx`, `apple-icon.tsx`,
 * `opengraph-image.tsx`) não leem o `@theme` e levam as cores escritas.
 *
 * Por isso `simbolo` é função e não componente: `ImageResponse` desenha
 * elementos de SVG comuns, e uma função chamada na hora devolve exatamente
 * isso, sem depender de como cada renderizador trata componentes.
 */

/** O símbolo, no quadro de 64 × 64. */
export function simbolo({
  aro,
  disco,
  pessoa,
}: {
  aro: string;
  disco: string;
  pessoa: string;
}) {
  return [
    <circle
      key="aro"
      cx="36"
      cy="28"
      r="18"
      stroke={aro}
      strokeWidth="8"
      fill="none"
    />,
    /*
     * O cabo nasce no meio do aro, não na borda de dentro.
     *
     * A ponta é arredondada e avança meia espessura (4,5) para trás de onde
     * a linha começa. Saindo de (24,5 ; 39,5), a ponta entrava no vão entre
     * o aro e o disco e aparecia como uma saliência. De (22,56 ; 41,44) ela
     * fica toda dentro da espessura do aro.
     */
    <line
      key="cabo"
      x1="22.56"
      y1="41.44"
      x2="9.5"
      y2="54.5"
      stroke={aro}
      strokeWidth="9"
      strokeLinecap="round"
    />,
    <circle key="disco" cx="36" cy="28" r="11.5" fill={disco} />,
    <circle key="cabeca" cx="36" cy="23.6" r="3.9" fill={pessoa} />,
    <path
      key="ombros"
      d="M28.6 35.5c0-3.8 3.2-6.2 7.4-6.2s7.4 2.4 7.4 6.2Z"
      fill={pessoa}
    />,
  ];
}

/**
 * O nome "Lupa" desenhado, em Outfit Bold com espaçamento de −0,03 em.
 *
 * É contorno de letra, não texto: o app não carrega a Outfit, que não é a
 * fonte do resto da interface (Geist), e a imagem do link, gerada no
 * servidor, não tem como buscá-la. Os números estão em unidades de uma
 * fonte de tamanho 100 com a linha de base em y = 0, então o L sobe até
 * −70,6 (altura das maiúsculas) e o p desce até 20,5.
 *
 * Fonte: Outfit 5.3.0 (@fontsource/outfit), licença OFL-1.1, que permite o
 * uso comercial e a conversão em contornos.
 */
export const NOME = {
  d: "M53.80 0L6.80 0L6.80-70.60L22.50-70.60L22.50-13.80L53.80-13.80M80.10 1.10Q73.40 1.10 68.25-1.65Q63.10-4.40 60.20-9.25Q57.30-14.10 57.30-20.40L57.30-48.60L72.60-48.60L72.60-20.60Q72.60-18.10 73.45-16.30Q74.30-14.50 76-13.50Q77.70-12.50 80.10-12.50Q83.50-12.50 85.50-14.65Q87.50-16.80 87.50-20.60L87.50-48.60L102.80-48.60L102.80-20.50Q102.80-14.10 99.90-9.25Q97-4.40 91.90-1.65Q86.80 1.10 80.10 1.10M137.40 1Q132.50 1 128.40-0.90Q126.20-1.90 124.50-3.30L124.50 20.50L109.40 20.50L109.40-48.60L124.70-48.60L124.70-45.20Q126.40-46.60 128.40-47.60Q132.50-49.60 137.40-49.60Q144.30-49.60 149.65-46.30Q155-43 158.05-37.30Q161.10-31.60 161.10-24.30Q161.10-17 158.05-11.30Q155-5.60 149.65-2.30Q144.30 1 137.40 1M134.60-12.80Q137.90-12.80 140.35-14.30Q142.80-15.80 144.20-18.40Q145.60-21 145.60-24.30Q145.60-27.70 144.20-30.30Q142.80-32.90 140.35-34.35Q137.90-35.80 134.70-35.80Q131.50-35.80 129.05-34.35Q126.60-32.90 125.20-30.30Q123.80-27.70 123.80-24.30Q123.80-21 125.15-18.40Q126.50-15.80 129-14.30Q131.50-12.80 134.60-12.80M186.20 1Q179.50 1 174.25-2.30Q169-5.60 165.95-11.30Q162.90-17 162.90-24.30Q162.90-31.60 165.95-37.30Q169-43 174.25-46.30Q179.50-49.60 186.20-49.60Q191.10-49.60 195.10-47.70Q197.60-46.50 199.60-44.60L199.60-48.60L214.60-48.60L214.60 0L199.60 0L199.60-3.90Q197.70-2.10 195.10-0.90Q191.10 1 186.20 1M189.30-12.80Q194.20-12.80 197.20-16.05Q200.20-19.30 200.20-24.30Q200.20-27.70 198.85-30.30Q197.50-32.90 195.05-34.35Q192.60-35.80 189.40-35.80Q186.20-35.80 183.75-34.35Q181.30-32.90 179.85-30.30Q178.40-27.70 178.40-24.30Q178.40-21 179.80-18.40Q181.20-15.80 183.70-14.30Q186.20-12.80 189.30-12.80",
  /**
   * O quadro cobre só a altura das maiúsculas, e o p desce para fora dele.
   * Assim o nome se centraliza pelo L, que é o que o olho mede, e não pelo
   * rabo do p; quem desenha liga `overflow: visible`.
   */
  viewBox: "6.8 -70.6 207.8 70.6",
  largura: 207.8,
  altura: 70.6,
} as const;

/**
 * O nome ao lado do símbolo, para quem desenha a logo inteira num SVG só
 * (a imagem do link). O quadro é de 180 × 64; o símbolo ocupa o canto da
 * esquerda e o nome vem depois, com a altura das maiúsculas em cerca de
 * 70% da altura do símbolo.
 */
export const LOGO_HORIZONTAL = {
  viewBox: "0 0 180 64",
  nome: "translate(63.2 51.5) scale(0.521)",
} as const;
