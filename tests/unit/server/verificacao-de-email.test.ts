/**
 * @vitest-environment node
 *
 * Verificação de e-mail (#227).
 *
 * `usuarios.email_verificado` existia desde o começo, era lido pelos
 * repositórios, e **nada nunca escrevia nele** — a armadilha do estado
 * declarado sem produtor, que este projeto já registra três vezes.
 *
 * O teste que mais importa aqui não é o caminho feliz: é o de que o token
 * de verificação **não troca senha**. Ele sai com muito mais liberdade que
 * o de recuperação — no cadastro e a cada "reenviar" —, e sem a separação
 * cada reenvio seria mais um link de redefinição circulando.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { limparLimites } from "@/server/auth/rate-limit";
import { redefinirSenha } from "@/server/auth/recuperacao";
import {
  confirmarEmail,
  enviarVerificacaoDeEmail,
} from "@/server/auth/verificacao-email";
import { usarRepositorio } from "@/server/repositories";
import { RepositorioMemoria } from "@/server/repositories/memoria";

const OPCOES = {
  urlBase: "https://lupapp.com.br",
  origem: "187.1.2.3",
};

let repo: RepositorioMemoria;
let enviados: { para: string; corpo: string }[];

/** O token que viajou no último e-mail — é tudo que a pessoa recebe. */
function tokenDoUltimoEmail(): string {
  const corpo = enviados.at(-1)?.corpo ?? "";
  return /verificar-email\?token=([^\s]+)/.exec(corpo)?.[1] ?? "";
}

vi.mock("@/server/email", () => ({
  temEmailConfigurado: true,
  enviarEmail: async (email: { para: string; corpo: string }) => {
    enviados.push(email);
    return { ok: true };
  },
}));

describe("verificação de e-mail", () => {
  let usuarioId: string;
  let restaurar: () => void;

  beforeEach(async () => {
    enviados = [];
    limparLimites();
    repo = new RepositorioMemoria();
    restaurar?.();
    restaurar = usarRepositorio(repo);

    const usuario = await repo.criar({
      email: "maria@teste.lupa",
      senhaHash: "hash-antigo",
      papel: "candidato_clt",
      nomeCompleto: "Maria Souza",
      telefone: "66999110001",
      cidade: "Sinop",
      bairro: null,
    });
    usuarioId = usuario.id;
  });

  it("a conta nasce sem o e-mail confirmado", async () => {
    expect((await repo.porId(usuarioId))?.emailVerificado).toBe(false);
  });

  it("o link do e-mail confirma, e uma vez só", async () => {
    await enviarVerificacaoDeEmail(usuarioId, OPCOES);
    const token = tokenDoUltimoEmail();

    expect(await confirmarEmail(token)).toBe(true);
    expect((await repo.porId(usuarioId))?.emailVerificado).toBe(true);

    // Uso único: o segundo clique não faz nada, e não explode.
    expect(await confirmarEmail(token)).toBe(false);
  });

  /**
   * O teste que decide se isto é seguro.
   *
   * O token de verificação é mandado com muito mais liberdade que o de
   * senha. Se ele também redefinisse senha, cada "reenviar" seria mais um
   * link de redefinição circulando — e a pessoa nem saberia que pediu um.
   *
   * A separação mora na instrução que **consome** o token, não numa
   * checagem antes: duas requisições simultâneas atravessariam a checagem.
   */
  it("o token de verificação não redefine senha", async () => {
    await enviarVerificacaoDeEmail(usuarioId, OPCOES);
    const token = tokenDoUltimoEmail();

    await expect(redefinirSenha(token, "outra-senha-123")).rejects.toThrow();

    // E continua valendo para o que ele é: a tentativa falha não o gasta.
    expect(await confirmarEmail(token)).toBe(true);
  });

  it("e-mail já confirmado não manda outro", async () => {
    await enviarVerificacaoDeEmail(usuarioId, OPCOES);
    expect(await confirmarEmail(tokenDoUltimoEmail())).toBe(true);

    const antes = enviados.length;
    const resultado = await enviarVerificacaoDeEmail(usuarioId, OPCOES);

    // Sucesso, não erro: quem clicou duas vezes em "reenviar" não precisa
    // de uma mensagem vermelha.
    expect(resultado.ok).toBe(true);
    expect(enviados.length).toBe(antes);
  });

  it("token inventado não confirma ninguém", async () => {
    expect(await confirmarEmail("nao-existe")).toBe(false);
    expect((await repo.porId(usuarioId))?.emailVerificado).toBe(false);
  });

  /**
   * O endereço nunca vai para o log nem para o corpo de outro e-mail — a
   * mesma regra da recuperação: numa cidade do tamanho de Sinop, a lista
   * de quem tem conta é a lista de quem está procurando emprego.
   */
  it("o e-mail vai só para o dono do endereço", async () => {
    await enviarVerificacaoDeEmail(usuarioId, OPCOES);
    expect(enviados.at(-1)?.para).toBe("maria@teste.lupa");
  });
});
