/**
 * @vitest-environment node
 *
 * A vaga individual abre sem sessão, e só ela (#490).
 *
 * Quando a empresa cola o link no WhatsApp, quem clica cai numa página de
 * entrar — e o robô que monta a prévia do link também, sem sessão nenhuma. O
 * que se prova aqui é o recorte: `/vagas/<id>` e a miniatura dela abrem, e
 * tudo o que está em volta continua fechado. Um padrão largo demais
 * (`/vagas/*`) abriria o que a página da vaga não mostra a anônimo.
 */
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { proxy } from "@/proxy";

function semSessao(caminho: string) {
  return proxy(new NextRequest(`https://lupapp.com.br${caminho}`));
}

const redirecionaParaOLogin = (r: Response) =>
  r.status >= 300 &&
  r.status < 400 &&
  (r.headers.get("location") ?? "").includes("/entrar");

describe("vaga pública no proxy", () => {
  it.each([
    "/vagas/job-operador-maquinas",
    "/vagas/11111111-1111-4111-8111-000000000001",
    "/vagas/job-operador-maquinas/opengraph-image",
    "/vagas/job-operador-maquinas/opengraph-image-1a2b3c",
  ])("%s abre sem sessão", async (caminho) => {
    const resposta = await semSessao(caminho);

    expect(redirecionaParaOLogin(resposta)).toBe(false);
    expect(resposta.status).toBe(200);
  });

  /**
   * A lista é fechada porque é ela que expõe a busca; a vaga individual é o
   * que se compartilha. Abrir uma abriria a outra por descuido.
   */
  it("a lista de vagas continua pedindo login", async () => {
    expect(redirecionaParaOLogin(await semSessao("/vagas"))).toBe(true);
    expect(
      redirecionaParaOLogin(await semSessao("/vagas?cidade=Sinop%20-%20MT")),
    ).toBe(true);
  });

  it("o destino do login guarda a vaga, para voltar a ela", async () => {
    const resposta = await semSessao("/vagas");
    expect(resposta.headers.get("location")).toContain("destino=%2Fvagas");
  });

  it.each([
    "/vagas/job-operador-maquinas/editar",
    "/vagas/job-operador-maquinas/qualquer-coisa",
    "/vagas/job-operador-maquinas/opengraph-image/extra",
    "/vagas/",
  ])("%s continua pedindo login", async (caminho) => {
    expect(redirecionaParaOLogin(await semSessao(caminho))).toBe(true);
  });

  it.each(["/servicos/abc", "/perfil", "/empresa", "/candidatos/abc"])(
    "%s não ganhou nada com a mudança",
    async (caminho) => {
      expect(redirecionaParaOLogin(await semSessao(caminho))).toBe(true);
    },
  );

  it("a arte de story é de dono: sem sessão, a API responde 401", async () => {
    const resposta = await semSessao("/api/vagas/job-operador-maquinas/arte");
    expect(resposta.status).toBe(401);
  });

  it("a página aberta carrega a política de segurança como as outras", async () => {
    const resposta = await semSessao("/vagas/job-operador-maquinas");
    expect(resposta.headers.get("content-security-policy")).toContain(
      "default-src",
    );
  });
});
