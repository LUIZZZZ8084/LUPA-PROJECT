export type Tema = "light" | "dark";

/**
 * Uma chave só, usada pelo script anti-flash no `<head>` e pelo botão em
 * `theme-toggle.tsx`. Duplicar a string nos dois lugares é o tipo de
 * coisa que diverge silenciosamente quando um dos dois muda sozinho.
 */
export const CHAVE_TEMA = "lupa:tema";

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
  if (t === "dark") document.documentElement.setAttribute("data-theme", "dark");
} catch (e) {}
`;
