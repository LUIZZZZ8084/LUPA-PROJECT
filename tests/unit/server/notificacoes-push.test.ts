/**
 * @vitest-environment node
 *
 * O envio em si.
 *
 * A regra que este arquivo protege é a de quando apagar uma inscrição.
 * Apagar demais tira do ar quem só estava sem sinal; apagar de menos deixa
 * a tabela virar cemitério de telefone trocado, e toda vaga publicada gasta
 * uma tentativa por aparelho que sumiu há meses.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const enviadas: unknown[] = [];
const estado = vi.hoisted(() => ({
  erro: null as { statusCode?: number } | null,
}));

vi.mock("web-push", () => ({
  default: {
    setVapidDetails: () => {},
    sendNotification: async (inscricao: unknown, corpo: unknown) => {
      if (estado.erro) throw estado.erro;
      enviadas.push({ inscricao, corpo });
    },
  },
}));

const INSCRICAO = {
  usuarioId: "u1",
  endpoint: "https://push.exemplo/abc",
  p256dh: "chave",
  auth: "sal",
};

const AVISO = {
  titulo: "Vaga nova em Sinop",
  corpo: "Operador de colheitadeira",
  url: "/vagas/vaga-1",
};

describe("envio de push", () => {
  let enviarPush: typeof import("@/server/notificacoes/push").enviarPush;

  beforeEach(async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "publica");
    vi.stubEnv("VAPID_PRIVATE_KEY", "privada");
    enviadas.length = 0;
    estado.erro = null;
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});

    enviarPush = (await import("@/server/notificacoes/push")).enviarPush;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("manda o aviso como JSON para o aparelho", async () => {
    expect(await enviarPush(INSCRICAO, AVISO)).toBe(true);

    expect(enviadas).toHaveLength(1);
    const { inscricao, corpo } = enviadas[0] as {
      inscricao: { endpoint: string; keys: { p256dh: string } };
      corpo: string;
    };
    expect(inscricao.endpoint).toBe(INSCRICAO.endpoint);
    expect(inscricao.keys.p256dh).toBe("chave");
    expect(JSON.parse(corpo)).toEqual(AVISO);
  });

  /**
   * 404 e 410 são a resposta para "este aparelho não existe mais" —
   * desinstalou, limpou os dados, trocou de telefone. É a única forma de
   * saber: o navegador não avisa ninguém.
   */
  it.each([404, 410])("status %i diz que o aparelho morreu", async (status) => {
    estado.erro = { statusCode: status };
    expect(await enviarPush(INSCRICAO, AVISO)).toBe(false);
  });

  /**
   * Falha de momento não apaga nada. Sumir com a inscrição de quem estava
   * sem sinal é pior que deixar de avisar uma vez — ela não volta sozinha,
   * e a pessoa nunca saberia por que parou de receber.
   */
  it.each([429, 500, 503])(
    "status %i não apaga a inscrição",
    async (status) => {
      estado.erro = { statusCode: status };
      expect(await enviarPush(INSCRICAO, AVISO)).toBe(true);
    },
  );

  it("erro sem status também não apaga", async () => {
    estado.erro = {};
    expect(await enviarPush(INSCRICAO, AVISO)).toBe(true);
  });

  /**
   * Sem chaves o push não existe, e o envio vira no-op silencioso — a
   * mesma degradação do Storage sem Supabase. `true` porque não há
   * inscrição morta a apagar: não houve tentativa.
   */
  it("sem chaves VAPID, não tenta enviar", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "");
    vi.stubEnv("VAPID_PRIVATE_KEY", "");

    const modulo = await import("@/server/notificacoes/push");
    expect(modulo.pushConfigurado).toBe(false);
    expect(await modulo.enviarPush(INSCRICAO, AVISO)).toBe(true);
    expect(enviadas).toHaveLength(0);
  });
});
