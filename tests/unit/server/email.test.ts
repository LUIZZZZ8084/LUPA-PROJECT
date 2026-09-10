/**
 * @vitest-environment node
 *
 * O envio de e-mail transacional (#174).
 *
 * Nenhum teste daqui fala com a rede: o `fetch` é injetado, mesmo padrão
 * do Mercado Pago e da BrasilAPI. Suíte que depende de provedor de
 * terceiro estar no ar falha vermelho sem ninguém ter mexido em nada.
 *
 * `temEmailConfigurado` é constante calculada na primeira importação —
 * por isso cada bloco reimporta o módulo depois de `vi.stubEnv`, em vez
 * de mexer em `process.env` e esperar que o módulo já carregado perceba.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

async function carregar() {
  vi.resetModules();
  return import("@/server/email");
}

const EMAIL = {
  para: "maria@teste.lupa",
  assunto: "Redefinir sua senha na Lupa",
  corpo: "Abra o link para criar uma senha nova.",
};

function respostaJson(corpo: unknown, status = 200) {
  return (async () =>
    new Response(JSON.stringify(corpo), {
      status,
      headers: { "content-type": "application/json" },
    })) as unknown as typeof fetch;
}

const foraDoAr = (async () => {
  throw new Error("timeout");
}) as unknown as typeof fetch;

describe("enviarEmail", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  function configurar() {
    vi.stubEnv("RESEND_API_KEY", "chave-de-teste");
    vi.stubEnv("EMAIL_REMETENTE", "Lupa <nao-responda@lupapp.com.br>");
  }

  /**
   * Sem credencial o recurso não existe, e quem chama precisa saber —
   * mesma degradação do Storage sem Supabase e do push sem VAPID. O que
   * não se pode é devolver `ok` e não mandar nada: a pessoa ficaria
   * esperando um e-mail que nunca sai.
   */
  it("sem credencial, recusa em vez de fingir que enviou", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("EMAIL_REMETENTE", "");
    const { enviarEmail, temEmailConfigurado } = await carregar();

    expect(temEmailConfigurado).toBe(false);

    const r = await enviarEmail(EMAIL, respostaJson({ id: "nao-deveria" }));
    expect(r.ok).toBe(false);
  });

  it("com só metade da configuração, também recusa", async () => {
    vi.stubEnv("RESEND_API_KEY", "chave-de-teste");
    vi.stubEnv("EMAIL_REMETENTE", "");
    const { temEmailConfigurado } = await carregar();

    expect(temEmailConfigurado).toBe(false);
  });

  it("manda o e-mail como texto puro, do remetente configurado", async () => {
    configurar();
    const { enviarEmail } = await carregar();

    let corpoEnviado: Record<string, unknown> = {};
    const espiao = (async (_url: string, init: RequestInit) => {
      corpoEnviado = JSON.parse(String(init.body));
      return new Response(JSON.stringify({ id: "email-1" }), { status: 200 });
    }) as unknown as typeof fetch;

    const r = await enviarEmail(EMAIL, espiao);

    expect(r.ok).toBe(true);
    expect(corpoEnviado.from).toBe("Lupa <nao-responda@lupapp.com.br>");
    expect(corpoEnviado.to).toEqual(["maria@teste.lupa"]);
    expect(corpoEnviado.subject).toBe(EMAIL.assunto);
    expect(corpoEnviado.text).toBe(EMAIL.corpo);
    /*
     * Sem HTML de propósito: template com imagem e botão é o formato que
     * os provedores mais pontuam como promoção, e este é justamente o
     * e-mail que precisa chegar na caixa de entrada, e rápido.
     */
    expect(corpoEnviado.html).toBeUndefined();
  });

  it("erro do provedor não vira sucesso", async () => {
    configurar();
    const { enviarEmail } = await carregar();

    const r = await enviarEmail(
      EMAIL,
      respostaJson({ message: "domain not verified" }, 403),
    );

    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.motivo).toContain("403");
  });

  it("timeout ou erro de rede vira recusa, nunca exceção", async () => {
    configurar();
    const { enviarEmail } = await carregar();

    const r = await enviarEmail(EMAIL, foraDoAr);
    expect(r.ok).toBe(false);
  });

  /**
   * O endereço não pode aparecer no log.
   *
   * Numa cidade do tamanho de Sinop, a lista de quem pediu recuperação de
   * senha é a lista de quem tem conta — a mesma informação que o login se
   * recusa a confirmar. Um log que a reconstrói desfaz o cuidado da tela.
   */
  it("não escreve o endereço no log", async () => {
    configurar();
    const { enviarEmail } = await carregar();
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    await enviarEmail(EMAIL, respostaJson({ id: "email-1" }));

    const escrito = log.mock.calls.flat().map(String).join(" ");
    expect(escrito).not.toContain("maria@teste.lupa");
  });
});
