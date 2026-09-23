/**
 * Produção não sobe sem o que produção precisa (#196).
 *
 * O caso real: o Mercado Pago entregou o aviso da primeira venda da Lupa
 * na URL certa, e nós recusamos com 401 porque o deploy no ar tinha um
 * `MERCADO_PAGO_WEBHOOK_SECRET` divergente. A recusa estava certa — o que
 * faltava era barulho. Estes testes travam o **modo de falha**: faltando
 * configuração, o processo derruba em vez de atender.
 *
 * A função recebe o ambiente por parâmetro de propósito: mexer em
 * `process.env` dentro de teste vaza para os vizinhos, e o que se quer
 * medir aqui é a decisão, não a leitura.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { conferirConfiguracaoDeProducao } from "@/server/config-obrigatoria";

type Ambiente = Record<string, string | undefined>;

const PRODUCAO_COMPLETA: Ambiente = {
  VERCEL_ENV: "production",
  // Valor de teste, não segredo: 40 caracteres, acima do mínimo de 32.
  SESSION_SECRET: "segredo-de-teste-com-quarenta-caracteres",
  NEXT_PUBLIC_APP_URL: "https://lupapp.com.br",
  MERCADO_PAGO_ACCESS_TOKEN: "APP_USR-token",
  MERCADO_PAGO_WEBHOOK_SECRET: "segredo",
};

function semA(chave: string): Ambiente {
  const { [chave]: _fora, ...resto } = PRODUCAO_COMPLETA;
  return resto;
}

describe("configuração obrigatória de produção", () => {
  it("com tudo no lugar, deixa subir", () => {
    expect(() =>
      conferirConfiguracaoDeProducao(PRODUCAO_COMPLETA),
    ).not.toThrow();
  });

  /**
   * `VERCEL_ENV` e não `NODE_ENV`: preview e o build da suíte e2e também
   * compilam com `NODE_ENV=production`, e derrubá-los tiraria justamente
   * os ambientes onde se testa antes de publicar.
   */
  it("fora de produção, não exige nada", () => {
    expect(() => conferirConfiguracaoDeProducao({})).not.toThrow();
    expect(() =>
      conferirConfiguracaoDeProducao({ VERCEL_ENV: "preview" }),
    ).not.toThrow();
  });

  it("sem a URL pública, derruba", () => {
    expect(() =>
      conferirConfiguracaoDeProducao(semA("NEXT_PUBLIC_APP_URL")),
    ).toThrow(/NEXT_PUBLIC_APP_URL/);
  });

  /**
   * O segredo da sessão (#271).
   *
   * Sem ele o site subia e ninguém entrava: `lerSessao` engole a recusa de
   * `segredo()` e devolve "sem sessão", e o login falha com erro interno.
   * A home abre, os crons rodam, e nada fica vermelho — a falha silenciosa
   * que a #196 fechou para o webhook, na porta de entrada do app inteiro.
   */
  describe("segredo da sessão", () => {
    it("sem ele, derruba", () => {
      expect(() =>
        conferirConfiguracaoDeProducao(semA("SESSION_SECRET")),
      ).toThrow(/SESSION_SECRET/);
    });

    /**
     * Presença não basta: `segredo()` recusa valor curto na hora de
     * assinar, então um valor de 31 caracteres produz o mesmo site onde
     * ninguém entra.
     */
    it("com menos de 32 caracteres, derruba e diz o mínimo", () => {
      expect(() =>
        conferirConfiguracaoDeProducao({
          ...PRODUCAO_COMPLETA,
          SESSION_SECRET: "a".repeat(31),
        }),
      ).toThrow(/SESSION_SECRET[\s\S]*32 caracteres/);
    });

    it("com exatamente 32, deixa subir", () => {
      expect(() =>
        conferirConfiguracaoDeProducao({
          ...PRODUCAO_COMPLETA,
          SESSION_SECRET: "a".repeat(32),
        }),
      ).not.toThrow();
    });

    /** Espaço colado junto não conta para o tamanho. */
    it("espaço sobrando não completa o mínimo", () => {
      expect(() =>
        conferirConfiguracaoDeProducao({
          ...PRODUCAO_COMPLETA,
          SESSION_SECRET: `${"a".repeat(30)}   `,
        }),
      ).toThrow(/SESSION_SECRET/);
    });
  });

  it("com cobrança ligada e sem o segredo do webhook, derruba", () => {
    expect(() =>
      conferirConfiguracaoDeProducao(semA("MERCADO_PAGO_WEBHOOK_SECRET")),
    ).toThrow(/MERCADO_PAGO_WEBHOOK_SECRET/);
  });

  /**
   * Sem token, o app roda em demonstração de pagamento: aprova na hora,
   * sem falar com o Mercado Pago. Não existe webhook para provar, e
   * exigir o segredo ali derrubaria um ambiente que nunca vai receber
   * notificação nenhuma.
   */
  it("sem cobrança ligada, o segredo do webhook não é exigido", () => {
    const {
      MERCADO_PAGO_ACCESS_TOKEN: _t,
      MERCADO_PAGO_WEBHOOK_SECRET: _s,
      ...resto
    } = PRODUCAO_COMPLETA;

    expect(() => conferirConfiguracaoDeProducao(resto)).not.toThrow();
  });

  /**
   * Uma variável por deploy seria cruel: quem lê este erro está com o site
   * fora do ar, e descobrir a segunda só depois de corrigir a primeira
   * custa mais um ciclo inteiro.
   */
  it("diz todas as que faltam de uma vez", () => {
    expect(() =>
      conferirConfiguracaoDeProducao({
        VERCEL_ENV: "production",
        MERCADO_PAGO_ACCESS_TOKEN: "APP_USR-token",
      }),
    ).toThrow(/NEXT_PUBLIC_APP_URL[\s\S]*MERCADO_PAGO_WEBHOOK_SECRET/);
  });

  /** Variável colada com espaço sobrando é variável que não está lá. */
  it("valor em branco conta como ausente", () => {
    expect(() =>
      conferirConfiguracaoDeProducao({
        ...PRODUCAO_COMPLETA,
        MERCADO_PAGO_WEBHOOK_SECRET: "   ",
      }),
    ).toThrow(/MERCADO_PAGO_WEBHOOK_SECRET/);
  });

  /** A mensagem tem que dizer o que fazer, não só o que falta. */
  it("a mensagem explica o estrago e o conserto", () => {
    expect(() =>
      conferirConfiguracaoDeProducao(semA("MERCADO_PAGO_WEBHOOK_SECRET")),
    ).toThrow(/republique/);
  });

  /**
   * O multiplicador de limite é da suíte e2e, onde uma conta faz o
   * trabalho de muitas. Em produção ele afrouxaria o teto de volume de
   * todas as ações — uma variável de ambiente desligando a proteção sem
   * ninguém perceber, que é a classe exata de coisa que a #195 e a #196
   * já custaram caro.
   */
  describe("multiplicador de limite", () => {
    it("derruba produção quando está definido", () => {
      expect(() =>
        conferirConfiguracaoDeProducao({
          ...PRODUCAO_COMPLETA,
          LIMITE_MULTIPLICADOR: "50",
        }),
      ).toThrow(/LIMITE_MULTIPLICADOR/);
    });

    /** `1` é o padrão escrito por extenso, e não afrouxa nada. */
    it("aceita 1, que é o mesmo que não ter", () => {
      expect(() =>
        conferirConfiguracaoDeProducao({
          ...PRODUCAO_COMPLETA,
          LIMITE_MULTIPLICADOR: "1",
        }),
      ).not.toThrow();
    });

    /** Fora de produção é justamente onde ele serve. */
    it("não incomoda em preview nem na suíte", () => {
      expect(() =>
        conferirConfiguracaoDeProducao({
          VERCEL_ENV: "preview",
          LIMITE_MULTIPLICADOR: "50",
        }),
      ).not.toThrow();
    });
  });

  /**
   * A chave anônima ainda pelo nome publicável (#221).
   *
   * **Avisa, não derruba**, e a escolha é a mesma que este arquivo pesa em
   * todo lugar: derrubar produção por causa de um *nome* de variável
   * trocaria um risco hipotético por uma indisponibilidade real. O valor
   * é o mesmo pelos dois nomes; o que muda é a promessa que o nome faz.
   */
  describe("nome da chave anônima", () => {
    let avisos: string[];

    beforeEach(() => {
      avisos = [];
      vi.spyOn(console, "warn").mockImplementation((...args: unknown[]) => {
        avisos.push(args.join(" "));
      });
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("avisa quando só existe o nome com NEXT_PUBLIC_", () => {
      conferirConfiguracaoDeProducao({
        ...PRODUCAO_COMPLETA,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "chave",
      });

      expect(avisos.join(" ")).toMatch(/NEXT_PUBLIC_SUPABASE_ANON_KEY/);
    });

    it("cala quando o nome novo existe", () => {
      conferirConfiguracaoDeProducao({
        ...PRODUCAO_COMPLETA,
        SUPABASE_ANON_KEY: "chave",
        // Mesmo com a antiga ainda por lá, durante a transição.
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "chave",
      });

      expect(avisos).toEqual([]);
    });

    /**
     * Sem Supabase nenhum é o modo demonstração, não uma configuração
     * errada. Avisar ali ensinaria a ignorar o aviso.
     */
    it("cala quando não há chave nenhuma", () => {
      conferirConfiguracaoDeProducao(PRODUCAO_COMPLETA);
      expect(avisos).toEqual([]);
    });
  });
});
