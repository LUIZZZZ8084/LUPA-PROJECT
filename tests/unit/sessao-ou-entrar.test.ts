/**
 * @vitest-environment node
 *
 * Sessão revogada vai ao login, não a "página não encontrada" (#330).
 *
 * O muro do `proxy.ts` confere a assinatura do token; a revogação pela
 * troca de senha (#225) é conferida depois, em `sessaoAtual()`. Quem
 * trocou a senha num aparelho e abria o app no outro passava pelo muro com
 * o token velho, e as telas que contavam com o muro respondiam 404.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

const { redirect } = vi.hoisted(() => ({
  redirect: vi.fn((destino: string) => {
    throw new Error(`NEXT_REDIRECT ${destino}`);
  }),
}));

vi.mock("next/navigation", () => ({ redirect }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}));
vi.mock("@/server/auth/revogacao", () => ({
  sessaoFoiRevogada: async () => false,
}));

import { sessaoOuEntrar } from "@/server/auth/cookies";

describe("sessaoOuEntrar", () => {
  it("sem sessão, manda ao login com o destino", async () => {
    await expect(sessaoOuEntrar("/perfil/editar")).rejects.toThrow(
      "NEXT_REDIRECT",
    );
    expect(redirect).toHaveBeenCalledWith("/entrar?destino=%2Fperfil%2Feditar");
  });
});

/**
 * Nenhuma tela de produto responde 404 por falta de sessão.
 *
 * A regra é de varredura porque o defeito era de repetição: cinco telas
 * tinham a mesma linha, cada uma com um comentário dizendo que o muro
 * cuidava disso. A área administrativa fica de fora de propósito — lá o
 * 404 vale para todo mundo, porque o login confirmaria que a área existe.
 */
describe("telas de produto", () => {
  const APP = join(process.cwd(), "src", "app", "(app)");

  function arquivos(dir: string): string[] {
    return readdirSync(dir).flatMap((nome) => {
      const caminho = join(dir, nome);
      if (statSync(caminho).isDirectory()) return arquivos(caminho);
      return nome.endsWith(".tsx") ? [caminho] : [];
    });
  }

  const telas = arquivos(APP).filter(
    (caminho) => !caminho.replace(/\\/g, "/").includes("/admin/"),
  );

  it("a varredura acha as telas", () => {
    expect(telas.length).toBeGreaterThan(20);
  });

  it("sessão ausente nunca vira notFound", () => {
    const culpadas = telas.filter((caminho) =>
      /if \(!sessao( \|\||\))[^;]*?notFound/.test(
        readFileSync(caminho, "utf8").replace(/\/\*[\s\S]*?\*\//g, ""),
      ),
    );

    expect(culpadas).toEqual([]);
  });
});
