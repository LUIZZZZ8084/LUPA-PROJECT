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
});
