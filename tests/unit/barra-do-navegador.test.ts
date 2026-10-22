/**
 * A cor da barra do navegador acompanha o tema (#479).
 *
 * O `layout.tsx` declara um `theme-color` fixo em claro, e o tema escuro só
 * trocava o atributo `data-theme`: no Android, e no app instalado, a barra
 * de cima ficava clara sobre uma tela escura. Quem decide a cor agora é o
 * tema, no carregamento (o script do `<head>`) e no clique (o botão).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  CHAVE_TEMA,
  COR_DA_BARRA,
  pintarBarraDoNavegador,
  SCRIPT_TEMA_INICIAL,
} from "@/lib/theme";

/** A primeira `<meta name="theme-color">` na ordem do documento: a que vale. */
function corQueVale(): string | null {
  return (
    document.head
      .querySelector('meta[name="theme-color"]')
      ?.getAttribute("content") ?? null
  );
}

function limpar() {
  document.documentElement.removeAttribute("data-theme");
  for (const m of document.head.querySelectorAll('meta[name="theme-color"]')) {
    m.remove();
  }
  localStorage.clear();
}

beforeEach(limpar);
afterEach(limpar);

describe("as cores da barra são as dos tokens", () => {
  const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

  it("o claro é o --color-bg do @theme", () => {
    const claro = css.match(/--color-bg:\s*(#[0-9a-fA-F]{6})/)?.[1];
    expect(COR_DA_BARRA.light.toLowerCase()).toBe(claro?.toLowerCase());
  });

  it("o escuro é o --color-bg do tema escuro", () => {
    const escuro = css.match(
      /data-theme="dark"\]\s*\{[^}]*?--color-bg:\s*(#[0-9a-fA-F]{6})/,
    )?.[1];
    expect(COR_DA_BARRA.dark.toLowerCase()).toBe(escuro?.toLowerCase());
  });
});

describe("o script do <head>", () => {
  function rodar() {
    new Function(SCRIPT_TEMA_INICIAL)();
  }

  it("com o escuro guardado, pinta a barra de escuro antes da primeira pintura", () => {
    localStorage.setItem(CHAVE_TEMA, "dark");
    rodar();

    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(corQueVale()).toBe(COR_DA_BARRA.dark);
  });

  it("a meta dele vem antes da do Next, que é quem o navegador lê primeiro", () => {
    const doNext = document.createElement("meta");
    doNext.setAttribute("name", "theme-color");
    doNext.setAttribute("content", COR_DA_BARRA.light);
    document.head.append(doNext);

    localStorage.setItem(CHAVE_TEMA, "dark");
    rodar();

    expect(
      document.head.querySelectorAll('meta[name="theme-color"]'),
    ).toHaveLength(2);
    expect(corQueVale()).toBe(COR_DA_BARRA.dark);
  });

  it("no claro, e sem nada guardado, não mexe em nada: vale a do Next", () => {
    rodar();
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
    expect(corQueVale()).toBeNull();

    localStorage.setItem(CHAVE_TEMA, "light");
    rodar();
    expect(corQueVale()).toBeNull();
  });
});

describe("pintarBarraDoNavegador", () => {
  it("cria a meta na primeira vez e reaproveita a mesma depois", () => {
    pintarBarraDoNavegador("dark");
    pintarBarraDoNavegador("light");
    pintarBarraDoNavegador("dark");

    expect(
      document.head.querySelectorAll('meta[name="theme-color"]'),
    ).toHaveLength(1);
    expect(corQueVale()).toBe(COR_DA_BARRA.dark);
  });

  it("volta ao claro, mesmo com a meta do Next ainda no <head>", () => {
    const doNext = document.createElement("meta");
    doNext.setAttribute("name", "theme-color");
    doNext.setAttribute("content", COR_DA_BARRA.light);
    document.head.append(doNext);

    pintarBarraDoNavegador("dark");
    expect(corQueVale()).toBe(COR_DA_BARRA.dark);
    pintarBarraDoNavegador("light");
    expect(corQueVale()).toBe(COR_DA_BARRA.light);
  });

  it("reaproveita a meta que o script do <head> já criou", () => {
    localStorage.setItem(CHAVE_TEMA, "dark");
    new Function(SCRIPT_TEMA_INICIAL)();
    pintarBarraDoNavegador("light");

    expect(
      document.head.querySelectorAll('meta[name="theme-color"]'),
    ).toHaveLength(1);
    expect(corQueVale()).toBe(COR_DA_BARRA.light);
  });
});
