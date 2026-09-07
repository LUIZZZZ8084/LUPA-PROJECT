/**
 * @vitest-environment node
 *
 * Avisos de vaga nova (#48).
 *
 * O que estes testes protegem é a promessa: quem pediu para ser avisado
 * recebe, quem não pediu não recebe, e desligar desliga de verdade. Aviso
 * que chega errado é pior que aviso nenhum — ensina a pessoa a ignorar o
 * balão, e aí nem a vaga certa alcança ela.
 *
 * Nada aqui fala com rede: o envio é injetado. Suíte que depende do serviço
 * de push estar no ar falha vermelho sem ninguém ter mexido em nada.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: false }));

const enviados: { endpoint: string; titulo: string }[] = [];
let mortos: string[] = [];

vi.mock("@/server/notificacoes/push", () => ({
  pushConfigurado: true,
  enviarPush: async (
    inscricao: { endpoint: string },
    aviso: { titulo: string },
  ) => {
    enviados.push({ endpoint: inscricao.endpoint, titulo: aviso.titulo });
    return !mortos.includes(inscricao.endpoint);
  },
}));

import type { Autenticado } from "@/server/auth/rbac";
import { ehAppError } from "@/server/errors";
import {
  RepositorioNotificacoesMemoria,
  usarRepositorioNotificacoes,
} from "@/server/notificacoes";
import {
  avisarVagaNova,
  desligarAvisos,
  inscreverAparelho,
  preferenciaAtual,
  salvarPreferencia,
} from "@/server/notificacoes/servico";

const candidato: Autenticado = { usuarioId: "cand-1", papel: "candidato_clt" };
const outro: Autenticado = { usuarioId: "cand-2", papel: "candidato_clt" };
const empresa: Autenticado = { usuarioId: "empresa-1", papel: "empresa" };

const VAGA = {
  id: "vaga-1",
  titulo: "Operador de colheitadeira",
  categoria: "Agronegócio",
  cidade: "Sinop",
  empresaId: empresa.usuarioId,
};

describe("avisos de vaga", () => {
  let repo: RepositorioNotificacoesMemoria;
  let restaurar: () => void;

  beforeEach(() => {
    repo = new RepositorioNotificacoesMemoria();
    restaurar = usarRepositorioNotificacoes(repo);
    enviados.length = 0;
    mortos = [];
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    restaurar();
    vi.restoreAllMocks();
  });

  async function ligar(
    sessao: Autenticado,
    cidade: string,
    categoria: string | null,
    endpoint = `https://push.exemplo/${sessao.usuarioId}`,
  ) {
    await salvarPreferencia(sessao, { cidade, categoria });
    await inscreverAparelho(sessao, { endpoint, p256dh: "chave", auth: "sal" });
  }

  describe("preferência", () => {
    it("guarda cidade e categoria, e devolve na leitura", async () => {
      await salvarPreferencia(candidato, {
        cidade: "Sinop",
        categoria: "Agronegócio",
      });

      expect(await preferenciaAtual(candidato)).toMatchObject({
        cidade: "Sinop",
        categoria: "Agronegócio",
      });
    });

    /**
     * Cidade livre viraria "Sinop", "sinop" e "Sinop-MT" na mesma base, e o
     * casamento com a vaga deixaria de acontecer: a pessoa marcaria a
     * preferência e nunca receberia nada, sem saber por quê.
     */
    it("cidade fora de Mato Grosso é recusada", async () => {
      const erro = await capturar(() =>
        salvarPreferencia(candidato, {
          cidade: "Curitiba",
          categoria: null,
        }),
      );
      expect(erro.codigo).toBe("validacao");
    });

    it("categoria inventada é recusada", async () => {
      const erro = await capturar(() =>
        salvarPreferencia(candidato, {
          cidade: "Sinop",
          categoria: "Astronauta",
        }),
      );
      expect(erro.codigo).toBe("validacao");
    });

    it("sem sessão é 401", async () => {
      const erro = await capturar(() =>
        salvarPreferencia(null, { cidade: "Sinop", categoria: null }),
      );
      expect(erro.codigo).toBe("nao_autenticado");
    });
  });

  describe("quem recebe", () => {
    it("quem pediu a cidade e a área recebe", async () => {
      await ligar(candidato, "Sinop", "Agronegócio");

      await avisarVagaNova(VAGA);

      expect(enviados).toHaveLength(1);
      expect(enviados[0].titulo).toContain("Sinop");
    });

    /** Sem categoria escolhida, recebe tudo o que sai na cidade dela. */
    it("quem pediu a cidade inteira recebe qualquer área", async () => {
      await ligar(candidato, "Sinop", null);

      await avisarVagaNova(VAGA);

      expect(enviados).toHaveLength(1);
    });

    it("quem pediu outra área não recebe", async () => {
      await ligar(candidato, "Sinop", "Administrativo");

      await avisarVagaNova(VAGA);

      expect(enviados).toHaveLength(0);
    });

    it("quem pediu outra cidade não recebe", async () => {
      await ligar(candidato, "Sorriso", "Agronegócio");

      await avisarVagaNova(VAGA);

      expect(enviados).toHaveLength(0);
    });

    /**
     * Quem publica está na mesma cidade e quase sempre na mesma categoria.
     * Sem esta regra, a primeira notificação que a pessoa recebe é a da
     * própria vaga — e a conclusão dela é que o aviso está quebrado.
     */
    it("ninguém é avisado da própria vaga", async () => {
      await ligar(empresa, "Sinop", "Agronegócio");

      await avisarVagaNova(VAGA);

      expect(enviados).toHaveLength(0);
    });

    /**
     * Vaga sem categoria não tem como se comparar com quem escolheu uma
     * área. Avisar mesmo assim ensinaria a ignorar o aviso.
     */
    it("vaga sem categoria alcança só quem pediu a cidade inteira", async () => {
      await ligar(candidato, "Sinop", null);
      await ligar(outro, "Sinop", "Agronegócio");

      await avisarVagaNova({ ...VAGA, categoria: null });

      expect(enviados.map((e) => e.endpoint)).toEqual([
        "https://push.exemplo/cand-1",
      ]);
    });

    /** Celular e computador: a pessoa quer ser avisada nos dois. */
    it("avisa todos os aparelhos da mesma pessoa", async () => {
      await ligar(candidato, "Sinop", "Agronegócio", "https://push.exemplo/a");
      await inscreverAparelho(candidato, {
        endpoint: "https://push.exemplo/b",
        p256dh: "chave",
        auth: "sal",
      });

      await avisarVagaNova(VAGA);

      expect(enviados).toHaveLength(2);
    });
  });

  /**
   * 404 e 410 são a resposta do serviço de push para "este aparelho não
   * existe mais". É a única forma de saber — o navegador não avisa ninguém.
   * Sem apagar, a tabela vira cemitério de telefone trocado e toda vaga
   * gasta uma tentativa por aparelho que sumiu há meses.
   */
  it("aparelho que morreu sai da tabela", async () => {
    await ligar(
      candidato,
      "Sinop",
      "Agronegócio",
      "https://push.exemplo/velho",
    );
    mortos = ["https://push.exemplo/velho"];

    await avisarVagaNova(VAGA);

    expect(await repo.inscricoesDe(candidato.usuarioId)).toEqual([]);
  });

  /**
   * "Dá para desativar facilmente" é critério de aceite. Meia desativação —
   * parar de avisar e guardar o que a pessoa procurava — manteria justamente
   * o dado que este projeto evita guardar.
   */
  it("desligar apaga a preferência e os aparelhos", async () => {
    await ligar(candidato, "Sinop", "Agronegócio");

    await desligarAvisos(candidato);

    expect(await preferenciaAtual(candidato)).toBeNull();
    expect(await repo.inscricoesDe(candidato.usuarioId)).toEqual([]);

    await avisarVagaNova(VAGA);
    expect(enviados).toHaveLength(0);
  });

  /** O dono vem da sessão: aceitar do corpo deixaria receber o aviso alheio. */
  it("a inscrição é gravada em nome de quem está na sessão", async () => {
    await inscreverAparelho(candidato, {
      endpoint: "https://push.exemplo/x",
      p256dh: "chave",
      auth: "sal",
    });

    expect(await repo.inscricoesDe(candidato.usuarioId)).toHaveLength(1);
    expect(await repo.inscricoesDe(outro.usuarioId)).toEqual([]);
  });
});

async function capturar(fn: () => Promise<unknown>) {
  try {
    await fn();
    throw new Error("esperava um erro, mas passou");
  } catch (e) {
    if (!ehAppError(e)) throw e;
    return e;
  }
}
