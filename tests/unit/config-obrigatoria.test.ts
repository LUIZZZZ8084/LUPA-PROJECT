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
import { describe, expect, it } from "vitest";
import { conferirConfiguracaoDeProducao } from "@/server/config-obrigatoria";

type Ambiente = Record<string, string | undefined>;

const PRODUCAO_COMPLETA: Ambiente = {
  VERCEL_ENV: "production",
  // Valor de teste, não segredo: 40 caracteres, acima do mínimo de 32.
  SESSION_SECRET: "segredo-de-teste-com-quarenta-caracteres",
  NEXT_PUBLIC_APP_URL: "https://lupapp.com.br",
  NEXT_PUBLIC_SUPABASE_URL: "https://exemplo.supabase.co",
  SUPABASE_ANON_KEY: "chave-anonima",
  SUPABASE_SERVICE_ROLE_KEY: "chave-de-servico",
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
   * O banco (#279).
   *
   * Sem ele o app não quebra: entra em modo demonstração, que é o que
   * permite rodá-lo sem infraestrutura. Em produção é o pior jeito de
   * falhar — dado de exemplo servido como real, conta criada numa memória
   * que some no próximo deploy, e nada vermelho. Esteve a um erro de
   * digitação de acontecer em 23/09/2026, na troca do nome da chave.
   */
  describe("Supabase", () => {
    for (const nome of [
      "NEXT_PUBLIC_SUPABASE_URL",
      "SUPABASE_ANON_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
    ]) {
      it(`sem ${nome}, derruba em vez de cair em demonstração`, () => {
        expect(() => conferirConfiguracaoDeProducao(semA(nome))).toThrow(
          new RegExp(nome),
        );
      });
    }

    it("a mensagem diz que o estrago é o modo demonstração", () => {
      expect(() =>
        conferirConfiguracaoDeProducao(semA("NEXT_PUBLIC_SUPABASE_URL")),
      ).toThrow(/modo demonstração/);
    });

    /**
     * O caso de quem pulou uma etapa da troca: só o nome antigo na Vercel.
     * A mensagem tem de dizer que a variável existe, com o nome errado —
     * "falta SUPABASE_ANON_KEY" sozinho mandaria a pessoa procurar uma
     * chave que ela sabe que cadastrou.
     */
    it("só com o nome antigo, derruba e diz qual é o conserto", () => {
      const { SUPABASE_ANON_KEY: _nova, ...resto } = PRODUCAO_COMPLETA;

      expect(() =>
        conferirConfiguracaoDeProducao({
          ...resto,
          NEXT_PUBLIC_SUPABASE_ANON_KEY: "chave-anonima",
        }),
      ).toThrow(/NEXT_PUBLIC_SUPABASE_ANON_KEY[\s\S]*nome antigo/);
    });

    /**
     * Demonstração continua sendo requisito de negócio: é como preview, a
     * suíte e2e e quem desenvolve sem credencial rodam o app inteiro.
     */
    it("em preview, pode rodar sem banco", () => {
      expect(() =>
        conferirConfiguracaoDeProducao({
          VERCEL_ENV: "preview",
          SESSION_SECRET: "segredo-de-teste-com-quarenta-caracteres",
        }),
      ).not.toThrow();
    });
  });
});
