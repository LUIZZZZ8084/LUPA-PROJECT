/**
 * @vitest-environment node
 *
 * A sessão renova sozinha, no proxy, e só em navegação (#323).
 *
 * A função de renovar existia desde 20/08 e nada a chamava: todo mundo era
 * deslogado sete dias depois de entrar. O teste que havia testava a função,
 * não o lugar que deveria chamá-la — e é por isso que o defeito passou um
 * mês verde. Aqui quem é exercitado é o `proxy()`, com o cookie de verdade.
 */
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { proxy } from "@/proxy";
import { assinarSessao, CONFIG_SESSAO, lerSessao } from "@/server/auth/session";

const DIA = 24 * 60 * 60 * 1000;

/** Um token assinado há `dias` dias, lido agora. */
async function tokenDeHaDias(dias: number): Promise<string> {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(Date.now() - dias * DIA);
  const { token } = await assinarSessao("u1", "candidato_clt");
  vi.useRealTimers();
  return token;
}

function pedido(token: string | null, method = "GET", caminho = "/vagas") {
  const cabecalhos = new Headers();
  if (token) cabecalhos.set("cookie", `${CONFIG_SESSAO.NOME_COOKIE}=${token}`);
  return new NextRequest(`https://lupapp.com.br${caminho}`, {
    method,
    headers: cabecalhos,
  });
}

const cookieNovo = (resposta: Response) =>
  resposta.headers
    .getSetCookie()
    .find((c) => c.startsWith(`${CONFIG_SESSAO.NOME_COOKIE}=`));

afterEach(() => {
  vi.useRealTimers();
});

describe("renovação da sessão no proxy", () => {
  it("quem navega com um token de dois dias recebe um novo, de sete", async () => {
    const antigo = await tokenDeHaDias(2);

    const resposta = await proxy(pedido(antigo));
    const cookie = cookieNovo(resposta);

    expect(cookie).toBeTruthy();
    const token = cookie?.split(";")[0].split("=")[1] ?? "";
    const lida = await lerSessao(token);
    const agora = Math.floor(Date.now() / 1000);

    expect(lida?.usuarioId).toBe("u1");
    expect(lida?.papel).toBe("candidato_clt");
    expect((lida?.expiraEm ?? 0) - agora).toBeGreaterThan(
      CONFIG_SESSAO.VALIDADE_SEGUNDOS - 60,
    );
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=lax/i);
  });

  it("token de hoje não reescreve o cookie", async () => {
    const { token } = await assinarSessao("u1", "candidato_clt");
    expect(cookieNovo(await proxy(pedido(token)))).toBeUndefined();
  });

  /**
   * Server action é POST, e é por ela que entrar, sair, virar prestador e
   * trocar a senha gravam o cookie. Um segundo `Set-Cookie` do proxy na
   * mesma resposta podia vencer o da action — e desfazer o que ela fez.
   */
  it("POST nunca renova: o cookie da action não pode ter concorrente", async () => {
    const antigo = await tokenDeHaDias(2);
    expect(cookieNovo(await proxy(pedido(antigo, "POST")))).toBeUndefined();
  });

  it("sem sessão, nada é gravado", async () => {
    expect(cookieNovo(await proxy(pedido(null, "GET", "/")))).toBeUndefined();
  });

  it("token vencido não é ressuscitado", async () => {
    const vencido = await tokenDeHaDias(8);
    const resposta = await proxy(pedido(vencido));

    expect(cookieNovo(resposta)).toBeUndefined();
    expect(resposta.status).toBe(307);
  });
});
