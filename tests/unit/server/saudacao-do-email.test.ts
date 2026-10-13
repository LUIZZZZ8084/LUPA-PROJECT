/**
 * @vitest-environment node
 *
 * O nome do cadastro no texto dos e-mails (#445).
 *
 * A conta pode ser criada com o e-mail de outra pessoa, e o e-mail de
 * confirmação sai sozinho no cadastro. A saudação cortava o nome no espaço
 * comum e levava o resto como veio: com outro espaço Unicode entre as
 * palavras, uma frase inteira com link chegava à caixa de quem não pediu
 * nada, dentro de um e-mail legítimo da Lupa.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: false }));

const enviados: { para: string; corpo: string }[] = [];

vi.mock("@/server/email", () => ({
  temEmailConfigurado: true,
  enviarEmail: async (email: { para: string; corpo: string }) => {
    enviados.push(email);
    return { ok: true as const };
  },
}));

import { limparLimites } from "@/server/auth/rate-limit";
import { pedirRecuperacao } from "@/server/auth/recuperacao";
import { enviarVerificacaoDeEmail } from "@/server/auth/verificacao-email";
import { saudacao } from "@/server/email/saudacao";
import { RepositorioMemoria, usarRepositorio } from "@/server/repositories";

const NBSP = " ";
/** O que quem cria a conta digita no lugar do nome. */
const NOME_ARMADO = [
  "Maria.",
  "\n\nSua",
  "conta",
  "será",
  "bloqueada.",
  "Confirme",
  "em",
  "https://lupa-seguranca.example/entrar",
].join(NBSP);

describe("saudacao", () => {
  it.each([
    ["Maria da Silva", "Olá, Maria."],
    ["  José   Carlos ", "Olá, José."],
    ["Ana-Clara Souza", "Olá, Ana-Clara."],
    ["D'Ávila Ramos", "Olá, D'Ávila."],
    ["Zé", "Olá, Zé."],
  ])("%s → %s", (nome, esperado) => {
    expect(saudacao(nome)).toBe(esperado);
  });

  it("espaço que não é o comum também separa o primeiro nome", () => {
    expect(saudacao(`Maria${NBSP}da${NBSP}Silva`)).toBe("Olá, Maria.");
  });

  it("nada além de letras, apóstrofo e hífen sai do nome", () => {
    const linha = saudacao(NOME_ARMADO);
    expect(linha).toBe("Olá, Maria.");
  });

  it("endereço no lugar do nome não vira link", () => {
    expect(saudacao("https://lupa-seguranca.example/x")).not.toMatch(
      /[:/.]{2}/,
    );
    expect(saudacao("www.lupa-seguranca.example")).not.toContain(".example");
  });

  it("sem nome aproveitável, é só 'Olá.'", () => {
    expect(saudacao("12345 67")).toBe("Olá.");
    expect(saudacao("")).toBe("Olá.");
  });

  it("o nome tem teto", () => {
    expect(saudacao("A".repeat(500)).length).toBeLessThanOrEqual(40);
  });
});

describe("nos dois e-mails", () => {
  let repo: RepositorioMemoria;
  let restaurar: () => void;
  let usuarioId: string;

  beforeEach(async () => {
    repo = new RepositorioMemoria();
    restaurar = usarRepositorio(repo);
    enviados.length = 0;
    limparLimites();
    vi.spyOn(console, "log").mockImplementation(() => {});

    const usuario = await repo.criar({
      email: "vitima@teste.lupa",
      senhaHash: "hash",
      papel: "candidato_clt",
      nomeCompleto: NOME_ARMADO,
      telefone: "66999990000",
      cidade: "Sinop - MT",
    });
    usuarioId = usuario.id;
  });

  afterEach(() => {
    restaurar();
    vi.restoreAllMocks();
  });

  function semInjecao(corpo: string) {
    expect(corpo.split("\n")[0]).toBe("Olá, Maria.");
    expect(corpo).not.toContain("lupa-seguranca");
    expect(corpo).not.toContain("bloqueada");
  }

  it("confirmação de e-mail", async () => {
    await enviarVerificacaoDeEmail(usuarioId, {
      urlBase: "https://lupapp.com.br",
      origem: "203.0.113.1",
    });
    semInjecao(enviados.at(-1)?.corpo ?? "");
  });

  it("recuperação de senha", async () => {
    await pedirRecuperacao("vitima@teste.lupa", {
      origem: "203.0.113.2",
      urlBase: "https://lupapp.com.br",
      dormir: async () => {},
    });
    semInjecao(enviados.at(-1)?.corpo ?? "");
  });
});
