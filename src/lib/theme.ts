export type Tema = "light" | "dark";

/**
 * Uma chave só, usada pelo script anti-flash no `<head>` e pelo botão em
 * `theme-toggle.tsx`. Duplicar a string nos dois lugares é o tipo de
 * coisa que diverge silenciosamente quando um dos dois muda sozinho.
 */
export const CHAVE_TEMA = "lupa:tema";

/**
 * A cor da barra do navegador e do app instalado em cada tema (#479).
 *
 * É o `--color-bg` de cada tema em `globals.css`, o fundo que o cabeçalho
 * repete: o `theme-color` fixo em claro, que o `layout.tsx` declara, deixava
 * a barra do Android clara em cima de uma tela escura. Um teste confere que
 * as duas cores continuam iguais às dos tokens.
 */
export const COR_DA_BARRA: Record<Tema, string> = {
  light: "#f7f8fa",
  dark: "#0b0f14",
};

/**
 * A marca da `<meta name="theme-color">` que é nossa.
 *
 * O Next escreve a dele a partir de `viewport.themeColor`, e pode refazê-la
 * numa navegação. Esta é outra, posta como a primeira do `<head>`: quando
 * há duas, o navegador usa a primeira, então o tema escolhido vale sem
 * depender do que o Next fizer com a dele.
 */
const MARCA_DA_META = "data-lupa-barra";

/**
 * Põe a barra do navegador na cor do tema, criando a `<meta>` na primeira vez.
 *
 * É a versão para o clique no botão de tema. Antes da primeira pintura quem
 * faz o mesmo é o script abaixo, que não pode importar nada.
 */
export function pintarBarraDoNavegador(tema: Tema): void {
  let meta = document.head.querySelector(`meta[${MARCA_DA_META}]`);
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("name", "theme-color");
    meta.setAttribute(MARCA_DA_META, "");
    document.head.insertBefore(meta, document.head.firstChild);
  }
  meta.setAttribute("content", COR_DA_BARRA[tema]);
}

/**
 * Roda antes da primeira pintura, direto no `<head>`.
 *
 * Claro é o padrão da plataforma — o `@theme` em `globals.css` já nasce
 * com os valores claros, sem precisar de atributo nenhum. Este script só
 * tem uma pessoa para avisar: quem *já escolheu* escuro antes. Sem ele,
 * essa escolha piscaria em claro por um instante a cada carregamento —
 * o mesmo flash que motivou o padrão claro existir em primeiro lugar,
 * só que na direção contrária.
 */
export const SCRIPT_TEMA_INICIAL = `
try {
  var t = localStorage.getItem(${JSON.stringify(CHAVE_TEMA)});
  if (t === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
    var m = document.createElement("meta");
    m.setAttribute("name", "theme-color");
    m.setAttribute(${JSON.stringify(MARCA_DA_META)}, "");
    m.setAttribute("content", ${JSON.stringify(COR_DA_BARRA.dark)});
    document.head.insertBefore(m, document.head.firstChild);
  }
} catch (e) {}
`;
