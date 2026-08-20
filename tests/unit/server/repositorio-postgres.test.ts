/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * O mapeamento entre `snake_case` do banco e `camelCase` da aplicação é
 * exatamente onde mora o bug silencioso: um campo escrito errado não quebra
 * a compilação, vira `undefined` em produção e só aparece quando alguém não
 * consegue entrar.
 */

interface Resposta {
  data: unknown;
  error: { message: string; code?: string } | null;
}

const chamadas: { tabela: string; metodo: string; args: unknown[] }[] = [];
let resposta: Resposta = { data: null, error: null };

function construtor(tabela: string) {
  const builder: Record<string, unknown> = {
    maybeSingle: async () => resposta,
    single: async () => resposta,
    then: (resolver: (v: Resposta) => unknown) =>
      Promise.resolve(resposta).then(resolver),
  };

  for (const metodo of ["select", "eq", "insert", "update"]) {
    builder[metodo] = (...args: unknown[]) => {
      chamadas.push({ tabela, metodo, args });
      return builder;
    };
  }

  return builder;
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ from: (tabela: string) => construtor(tabela) }),
}));

import { RepositorioPostgres } from "@/server/repositories/postgres";

const LINHA = {
  id: "11111111-1111-4111-8111-000000000001",
  email: "joao@teste.lupa",
  senha_hash: "$argon2id$v=19$m=19456,t=2,p=1$abc$def",
  papel: "prestador_servico",
  nome_completo: "João Silva",
  telefone: "66999110001",
  cidade: "Sinop",
  bairro: "Centro",
  avatar_url: "https://exemplo/avatar.svg",
  email_verificado: true,
  telefone_verificado: true,
  doc_verificado: false,
  criado_em: "2026-08-20T00:00:00.000Z",
  ultimo_acesso_em: null,
};

describe("RepositorioPostgres", () => {
  const repo = new RepositorioPostgres();

  beforeEach(() => {
    chamadas.length = 0;
    resposta = { data: null, error: null };
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("traduz cada coluna para o campo da aplicação", async () => {
    resposta = { data: LINHA, error: null };

    const usuario = await repo.porEmail("joao@teste.lupa");

    expect(usuario).toEqual({
      id: LINHA.id,
      email: "joao@teste.lupa",
      senhaHash: LINHA.senha_hash,
      papel: "prestador_servico",
      nomeCompleto: "João Silva",
      telefone: "66999110001",
      cidade: "Sinop",
      bairro: "Centro",
      avatarUrl: "https://exemplo/avatar.svg",
      emailVerificado: true,
      telefoneVerificado: true,
      docVerificado: false,
      criadoEm: LINHA.criado_em,
      ultimoAcessoEm: null,
    });
  });

  it("consulta por e-mail em minúscula", async () => {
    resposta = { data: null, error: null };
    await repo.porEmail("JOAO@Teste.Lupa");

    const eq = chamadas.find((c) => c.metodo === "eq");
    expect(eq?.args).toEqual(["email", "joao@teste.lupa"]);
  });

  it("devolve null quando não encontra", async () => {
    expect(await repo.porEmail("ninguem@teste.lupa")).toBeNull();
    expect(await repo.porId("nao-existe")).toBeNull();
  });

  it("erro de consulta vira indisponível, não interno", async () => {
    resposta = { data: null, error: { message: "conexão recusada" } };

    await expect(repo.porEmail("joao@teste.lupa")).rejects.toMatchObject({
      codigo: "indisponivel",
    });
  });

  it("grava as colunas certas ao criar", async () => {
    resposta = { data: LINHA, error: null };

    await repo.criar({
      email: "Joao@Teste.Lupa",
      senhaHash: "hash",
      papel: "prestador_servico",
      nomeCompleto: "João Silva",
      telefone: "66999110001",
      cidade: "Sinop",
      bairro: "Centro",
    });

    const insert = chamadas.find((c) => c.metodo === "insert");
    expect(insert?.tabela).toBe("usuarios");
    expect(insert?.args[0]).toMatchObject({
      email: "joao@teste.lupa",
      senha_hash: "hash",
      nome_completo: "João Silva",
      cidade: "Sinop",
    });
  });

  /**
   * 23505 é violação de índice único. Traduzir para a mesma mensagem do
   * repositório em memória mantém o serviço de cadastro sem saber em qual
   * implementação está rodando.
   */
  it("e-mail duplicado no banco vira o mesmo erro da memória", async () => {
    resposta = {
      data: null,
      error: { message: "duplicate key", code: "23505" },
    };

    await expect(
      repo.criar({
        email: "joao@teste.lupa",
        senhaHash: "hash",
        papel: "empresa",
        nomeCompleto: "João",
        telefone: "66999110001",
        cidade: "Sinop",
      }),
    ).rejects.toThrow("email já cadastrado");
  });

  it("grava os perfis nas tabelas certas", async () => {
    await repo.criarPerfilEmpresa({
      usuarioId: "u1",
      razaoSocial: "Agro Norte",
      cnpj: "11222333000181",
      setor: null,
      porte: null,
      site: null,
      descricao: null,
      logoUrl: null,
      plano: "trial",
    });
    expect(chamadas.at(-1)).toMatchObject({
      tabela: "perfis_empresa",
      metodo: "insert",
    });

    await repo.criarPerfilPrestador({
      usuarioId: "u1",
      categoriaId: 1,
      descricao: null,
      precoInicial: null,
      anosExperiencia: null,
      bairrosAtendidos: [],
    });
    expect(chamadas.at(-1)?.tabela).toBe("perfis_prestador");

    await repo.criarPerfilCandidato({
      usuarioId: "u1",
      areaDesejada: null,
      resumo: null,
      curriculoUrl: null,
      disponibilidade: null,
    });
    expect(chamadas.at(-1)?.tabela).toBe("perfis_candidato");
  });

  /**
   * Registrar o último acesso é telemetria. Se falhar, a pessoa entra do
   * mesmo jeito — derrubar o login por causa de uma escrita de estatística
   * seria trocar um problema pequeno por um grande.
   */
  it("falha ao registrar acesso não interrompe o login", async () => {
    resposta = { data: null, error: { message: "timeout" } };
    await expect(repo.registrarAcesso("u1")).resolves.toBeUndefined();
  });

  it("cnpjEmUso responde pela existência da linha", async () => {
    resposta = { data: { usuario_id: "u1" }, error: null };
    expect(await repo.cnpjEmUso("11222333000181")).toBe(true);

    resposta = { data: null, error: null };
    expect(await repo.cnpjEmUso("11222333000181")).toBe(false);
  });

  it("atualizarSenhaHash escreve na coluna senha_hash", async () => {
    await repo.atualizarSenhaHash("u1", "novo-hash");

    const update = chamadas.find((c) => c.metodo === "update");
    expect(update?.args[0]).toEqual({ senha_hash: "novo-hash" });
  });
});
