/**
 * @vitest-environment node
 */
import { beforeAll, describe, expect, it, vi } from "vitest";

import {
  conferirSenha,
  gastarTempoDeVerificacao,
  gerarHash,
  precisaRehash,
} from "@/server/auth/password";
import {
  type Capacidade,
  capacidadesDe,
  ehPapel,
  exigirCapacidade,
  exigirDono,
  exigirPapel,
  PAPEIS,
  type Papel,
  pode,
} from "@/server/auth/rbac";
import {
  assinarSessao,
  CONFIG_SESSAO,
  lerSessao,
  limparCacheDoSegredo,
  renovarSeNecessario,
} from "@/server/auth/session";

describe("hash de senha", () => {
  it("gera um hash Argon2id, nunca a senha em claro", async () => {
    const h = await gerarHash("uma senha longa de teste");
    expect(h).toMatch(/^\$argon2id\$/);
    expect(h).not.toContain("uma senha longa de teste");
  });

  it("dois hashes da mesma senha são diferentes — o sal muda", async () => {
    const [a, b] = await Promise.all([
      gerarHash("mesma senha aqui"),
      gerarHash("mesma senha aqui"),
    ]);
    expect(a).not.toBe(b);
    // E ambos conferem.
    expect(await conferirSenha("mesma senha aqui", a)).toBe(true);
    expect(await conferirSenha("mesma senha aqui", b)).toBe(true);
  });

  it("aceita a senha certa e recusa a errada", async () => {
    const h = await gerarHash("senha correta 123");
    expect(await conferirSenha("senha correta 123", h)).toBe(true);
    expect(await conferirSenha("senha correta 124", h)).toBe(false);
    expect(await conferirSenha("", h)).toBe(false);
  });

  it("preserva acento e emoji", async () => {
    const senha = "coração 🇧🇷 açaí";
    expect(await conferirSenha(senha, await gerarHash(senha))).toBe(true);
  });

  /**
   * Um hash corrompido no banco não pode derrubar o login de todo mundo.
   */
  it("hash ilegível devolve false em vez de lançar", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(conferirSenha("qualquer", "lixo")).resolves.toBe(false);
    await expect(conferirSenha("qualquer", "")).resolves.toBe(false);
    vi.restoreAllMocks();
  });

  it("gastarTempoDeVerificacao não lança e não confirma nada", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(gastarTempoDeVerificacao("senha")).resolves.toBeUndefined();
    vi.restoreAllMocks();
  });

  it("precisaRehash aponta parâmetro fraco e ignora o atual", async () => {
    expect(precisaRehash(await gerarHash("senha de teste 123"))).toBe(false);
    expect(precisaRehash("$argon2id$v=19$m=4096,t=1,p=1$abc$def")).toBe(true);
    expect(precisaRehash("formato-desconhecido")).toBe(true);
  });
});

describe("sessão", () => {
  beforeAll(() => {
    vi.stubEnv("SESSION_SECRET", "a".repeat(48));
    limparCacheDoSegredo();
  });

  it("assina e relê o mesmo usuário e papel", async () => {
    const { token } = await assinarSessao("usuario-1", "empresa");
    const sessao = await lerSessao(token);

    expect(sessao).toMatchObject({ usuarioId: "usuario-1", papel: "empresa" });
  });

  /** Quem abrir o cookie não pode achar telefone nem e-mail lá dentro. */
  it("o payload carrega só id e papel", async () => {
    const { token } = await assinarSessao("usuario-1", "candidato_clt");
    const payload = JSON.parse(
      Buffer.from(token.split(".")[1], "base64url").toString(),
    );

    expect(Object.keys(payload).sort()).toEqual([
      "aud",
      "exp",
      "iat",
      "iss",
      "papel",
      "sub",
    ]);
  });

  it("token adulterado é recusado", async () => {
    const { token } = await assinarSessao("usuario-1", "candidato_clt");
    const [cabecalho, payload, assinatura] = token.split(".");

    // Troca o papel para admin e mantém a assinatura antiga.
    const forjado = JSON.parse(Buffer.from(payload, "base64url").toString());
    forjado.papel = "admin";
    const payloadForjado = Buffer.from(JSON.stringify(forjado)).toString(
      "base64url",
    );

    expect(
      await lerSessao(`${cabecalho}.${payloadForjado}.${assinatura}`),
    ).toBeNull();
  });

  it("token assinado com outro segredo é recusado", async () => {
    const { token } = await assinarSessao("usuario-1", "admin");

    vi.stubEnv("SESSION_SECRET", "b".repeat(48));
    limparCacheDoSegredo();
    expect(await lerSessao(token)).toBeNull();

    vi.stubEnv("SESSION_SECRET", "a".repeat(48));
    limparCacheDoSegredo();
  });

  it("token vazio ou sem sentido devolve null, sem lançar", async () => {
    expect(await lerSessao("")).toBeNull();
    expect(await lerSessao("não.é.jwt")).toBeNull();
    expect(await lerSessao("a.b")).toBeNull();
  });

  it("expira depois de sete dias", async () => {
    const { expiraEm } = await assinarSessao("usuario-1", "empresa");
    const agora = Math.floor(Date.now() / 1000);
    expect(expiraEm - agora).toBe(CONFIG_SESSAO.VALIDADE_SEGUNDOS);
  });

  it("token vencido não é aceito", async () => {
    const { token } = await assinarSessao("usuario-1", "empresa");
    // Avança o relógio para além da validade.
    vi.useFakeTimers();
    vi.setSystemTime(
      Date.now() + (CONFIG_SESSAO.VALIDADE_SEGUNDOS + 60) * 1000,
    );
    expect(await lerSessao(token)).toBeNull();
    vi.useRealTimers();
  });

  it("renova só quando falta pouco", async () => {
    const agora = Math.floor(Date.now() / 1000);

    const recente = {
      usuarioId: "u1",
      papel: "empresa" as Papel,
      expiraEm: agora + CONFIG_SESSAO.VALIDADE_SEGUNDOS,
    };
    expect(await renovarSeNecessario(recente)).toBeNull();

    const quaseVencendo = {
      usuarioId: "u1",
      papel: "empresa" as Papel,
      expiraEm: agora + 60,
    };
    const novo = await renovarSeNecessario(quaseVencendo);
    expect(novo).toBeTruthy();
    expect((await lerSessao(novo!))?.usuarioId).toBe("u1");
  });

  it("o cookie é httpOnly e SameSite=Lax", () => {
    const o = CONFIG_SESSAO.opcoesDoCookie(3600);
    expect(o.httpOnly).toBe(true);
    expect(o.sameSite).toBe("lax");
    expect(o.path).toBe("/");
  });
});

describe("RBAC", () => {
  const sessao = (papel: Papel, usuarioId = "u1") => ({ usuarioId, papel });

  it("reconhece os quatro papéis e recusa o resto", () => {
    for (const p of PAPEIS) expect(ehPapel(p)).toBe(true);
    expect(ehPapel("root")).toBe(false);
    expect(ehPapel(null)).toBe(false);
    expect(ehPapel("")).toBe(false);
  });

  it("candidato se candidata, mas não publica vaga", () => {
    expect(pode("candidato_clt", "candidatura:criar")).toBe(true);
    expect(pode("candidato_clt", "vaga:publicar")).toBe(false);
    expect(pode("candidato_clt", "admin:painel")).toBe(false);
  });

  it("prestador publica no perfil, mas não publica vaga", () => {
    expect(pode("prestador_servico", "publicacao:criar")).toBe(true);
    expect(pode("prestador_servico", "vaga:publicar")).toBe(false);
    expect(pode("prestador_servico", "candidatura:criar")).toBe(false);
  });

  it("empresa publica vaga e move candidatura, mas não se candidata", () => {
    expect(pode("empresa", "vaga:publicar")).toBe(true);
    expect(pode("empresa", "candidatura:mover_estagio")).toBe(true);
    expect(pode("empresa", "candidatura:criar")).toBe(false);
  });

  /**
   * A linha do admin: enxergar, sim; agir no lugar de outro papel, não.
   *
   * Ele alcança o que existe na ferramenta para poder dar suporte — o
   * painel, as métricas, a fila de verificação, a lista de candidatos
   * disponíveis. O que fica de fora é escrita com dono: publicar uma vaga
   * ou se candidatar em nome de alguém não deixa rastro de que não foi
   * aquela pessoa, e é isso que um acesso comprometido exploraria.
   */
  it("admin enxerga, mas não age no lugar de empresa nem de candidato", () => {
    expect(pode("admin", "admin:painel")).toBe(true);
    expect(pode("admin", "admin:decidir_verificacao")).toBe(true);
    expect(pode("admin", "candidato:buscar_disponiveis")).toBe(true);

    expect(pode("admin", "vaga:publicar")).toBe(false);
    expect(pode("admin", "candidatura:criar")).toBe(false);
    expect(pode("admin", "candidatura:mover_estagio")).toBe(false);
  });

  it("nenhum papel comum alcança as capacidades de admin", () => {
    const deAdmin: Capacidade[] = [
      "admin:painel",
      "admin:metricas",
      "admin:decidir_verificacao",
      "admin:moderar",
    ];

    for (const papel of PAPEIS.filter((p) => p !== "admin")) {
      for (const cap of deAdmin) {
        expect(pode(papel, cap), `${papel} → ${cap}`).toBe(false);
      }
    }
  });

  it("toda capacidade da matriz é única por papel", () => {
    for (const papel of PAPEIS) {
      const caps = capacidadesDe(papel);
      expect(new Set(caps).size, papel).toBe(caps.length);
    }
  });

  it("exigirPapel bloqueia sem sessão e com papel errado", () => {
    expect(() => exigirPapel(null, "empresa")).toThrow(/sessão/i);

    expect(() => exigirPapel(sessao("candidato_clt"), "empresa")).toThrow();

    expect(exigirPapel(sessao("empresa"), "empresa", "admin").papel).toBe(
      "empresa",
    );
  });

  it("exigirPapel distingue 401 de 403", () => {
    try {
      exigirPapel(null, "empresa");
    } catch (e) {
      expect((e as { codigo: string }).codigo).toBe("nao_autenticado");
    }
    try {
      exigirPapel(sessao("candidato_clt"), "empresa");
    } catch (e) {
      expect((e as { codigo: string }).codigo).toBe("sem_permissao");
    }
  });

  it("exigirCapacidade segue a matriz", () => {
    expect(() =>
      exigirCapacidade(sessao("empresa"), "vaga:publicar"),
    ).not.toThrow();

    expect(() =>
      exigirCapacidade(sessao("candidato_clt"), "vaga:publicar"),
    ).toThrow();
  });

  /**
   * "Pode editar vaga" não é "pode editar *esta* vaga". Sem essa segunda
   * pergunta, trocar o id na URL alcança o registro de outra empresa.
   */
  it("exigirDono barra acesso ao registro alheio", () => {
    expect(() =>
      exigirDono(sessao("empresa", "u1"), "u1", "Vaga"),
    ).not.toThrow();
    expect(() => exigirDono(sessao("empresa", "u1"), "u2", "Vaga")).toThrow();
  });

  it("dono errado responde 'não encontrado', não 'sem permissão'", () => {
    // 403 confirmaria que o registro existe — informação para quem sonda ids.
    try {
      exigirDono(sessao("empresa", "u1"), "u2", "Vaga");
    } catch (e) {
      expect((e as { codigo: string }).codigo).toBe("nao_encontrado");
    }
  });

  it("admin alcança registro de qualquer dono", () => {
    expect(() =>
      exigirDono(sessao("admin", "adm"), "u2", "Vaga"),
    ).not.toThrow();
  });

  it("exigirDono sem sessão é 401", () => {
    expect(() => exigirDono(null, "u1", "Vaga")).toThrow(/sessão/i);
  });
});
