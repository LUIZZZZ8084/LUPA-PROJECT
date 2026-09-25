/**
 * @vitest-environment node
 *
 * Canal de suporte (#235).
 *
 * Três coisas decidem se isto ajuda ou atrapalha, e cada uma tem teste: a
 * mensagem é gravada **antes** do envio, o envio falhando não perde a
 * mensagem, e o log não reconstrói quem escreveu nem sobre o quê.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let emails: { para: string; assunto: string; corpo: string }[] = [];
let envioFalha = false;
let emailConfigurado = true;

vi.mock("@/server/email", () => ({
  get temEmailConfigurado() {
    return emailConfigurado;
  },
  enviarEmail: async (email: {
    para: string;
    assunto: string;
    corpo: string;
  }) => {
    if (envioFalha) return { ok: false, motivo: "provedor fora do ar" };
    emails.push(email);
    return { ok: true };
  },
}));

vi.mock("@/lib/controlador", () => ({
  CONTROLADOR: {
    nomeFantasia: "Lupa",
    razaoSocial: "PALU LTDA",
    cnpj: "11222333000181",
    email: "suporte@exemplo.test",
    cidade: "Sinop",
    uf: "MT",
  },
}));

import { limparLimites } from "@/server/auth/rate-limit";
import {
  RepositorioSuporteMemoria,
  usarRepositorioSuporte,
} from "@/server/suporte";
import { receberMensagemDeSuporte } from "@/server/suporte/servico";

const PEDIDO = {
  nome: "Maria Souza",
  email: "Maria@Exemplo.test",
  assunto: "conta" as const,
  mensagem: "Não consigo entrar desde ontem, diz senha errada.",
  usuarioId: null,
  origem: "187.1.2.3",
};

describe("mensagem de suporte", () => {
  let repo: RepositorioSuporteMemoria;
  let restaurar: () => void;

  beforeEach(() => {
    emails = [];
    envioFalha = false;
    emailConfigurado = true;
    limparLimites();
    repo = new RepositorioSuporteMemoria();
    restaurar?.();
    restaurar = usarRepositorioSuporte(repo);
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("grava a mensagem e avisa por e-mail", async () => {
    await receberMensagemDeSuporte(PEDIDO);

    expect(repo.todas()).toHaveLength(1);
    expect(emails).toHaveLength(1);
    expect(emails[0].para).toBe("suporte@exemplo.test");
  });

  /** E-mail chega minúsculo, para não virar duas pessoas na caixa. */
  it("normaliza o endereço de quem escreveu", async () => {
    await receberMensagemDeSuporte(PEDIDO);
    expect(repo.todas()[0].email).toBe("maria@exemplo.test");
  });

  /**
   * O caso que decide o desenho: gravar **antes** de enviar.
   *
   * Na ordem inversa, um provedor fora do ar perderia a mensagem — e é
   * exatamente a hora em que quem escreveu mais precisa que ela não se
   * perca. Quem escreveu também não pode fazer nada a respeito, então a
   * falha não vira erro na tela: vira aviso no log.
   */
  it("provedor fora do ar não perde a mensagem, e não quebra para quem escreveu", async () => {
    envioFalha = true;

    await expect(receberMensagemDeSuporte(PEDIDO)).resolves.toBeUndefined();

    expect(repo.todas()).toHaveLength(1);
    expect(emails).toHaveLength(0);
  });

  /** Sem provedor configurado, a mensagem continua sendo gravada. */
  it("sem e-mail configurado, ainda grava", async () => {
    emailConfigurado = false;

    await receberMensagemDeSuporte(PEDIDO);

    expect(repo.todas()).toHaveLength(1);
    expect(emails).toHaveLength(0);
  });

  /**
   * O limite é por origem, como no cadastro e na recuperação de senha, e
   * pelo mesmo motivo: sem ele este formulário vira um canal para mandar
   * e-mail em nome da Lupa quantas vezes se quiser, e quem paga a reputação
   * do domínio somos nós. Conta toda tentativa, inclusive as que dão certo.
   */
  it("o limite por origem morde, e conta até as que dão certo", async () => {
    for (let i = 0; i < 5; i++) {
      await receberMensagemDeSuporte({
        ...PEDIDO,
        mensagem: `Tentativa ${i}.`,
      });
    }

    await expect(receberMensagemDeSuporte(PEDIDO)).rejects.toMatchObject({
      codigo: "muitas_tentativas",
    });
  });

  /**
   * O log não reconstrói quem escreveu nem o que escreveu.
   *
   * Mesma regra da recuperação de senha: um log que refaz a lista desfaz o
   * cuidado que a tabela tem. O que serve para operar é saber que chegou, e
   * de que assunto.
   */
  it("o log não carrega o e-mail nem o texto da mensagem", async () => {
    const linhas: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      linhas.push(args.map(String).join(" "));
    });

    await receberMensagemDeSuporte(PEDIDO);

    const tudo = linhas.join(" | ");
    expect(tudo).not.toContain("maria@exemplo.test");
    expect(tudo).not.toContain("senha errada");
    expect(tudo).toContain("suporte.receber");
  });

  /** Com sessão, o id vai junto: acelera a resposta e poupa a pessoa. */
  it("a sessão entra quando existe, e a falta dela não impede nada", async () => {
    await receberMensagemDeSuporte({ ...PEDIDO, usuarioId: "u-1" });
    expect(repo.todas()[0].usuarioId).toBe("u-1");

    limparLimites();
    await receberMensagemDeSuporte({ ...PEDIDO, origem: "outra" });
    expect(repo.todas()[1].usuarioId).toBeNull();
  });
});
