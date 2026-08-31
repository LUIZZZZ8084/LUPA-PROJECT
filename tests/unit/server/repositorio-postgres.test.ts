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

  for (const metodo of ["select", "eq", "insert", "update", "upsert"]) {
    builder[metodo] = (...args: unknown[]) => {
      chamadas.push({ tabela, metodo, args });
      return builder;
    };
  }

  return builder;
}

vi.mock("@/lib/supabase/service", () => ({
  temChaveDeServico: true,
  clienteDeServico: () => ({ from: (tabela: string) => construtor(tabela) }),
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
      instagram: null,
      facebook: null,
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
      instagram: null,
      facebook: null,
    });
    expect(chamadas.at(-1)?.tabela).toBe("perfis_prestador");

    await repo.criarPerfilCandidato({
      usuarioId: "u1",
      areaDesejada: null,
      resumo: null,
      curriculoUrl: null,
      disponibilidade: null,
      formacao: null,
      habilidades: [],
      visivelParaEmpresas: false,
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

/**
 * Leitura e escrita de perfil para a tela de edição.
 *
 * Aqui o mapeamento importa mais do que em qualquer outro lugar: foi
 * exatamente uma coluna errada — `profile_id` numa tabela cuja chave é
 * `usuario_id` — que derrubou o painel da empresa inteiro com o banco
 * ligado. Não quebrou compilação, não apareceu em revisão de leitura, e só
 * deu as caras quando alguém abriu a tela.
 */
describe("perfis para a edição", () => {
  const repo = new RepositorioPostgres();
  const ID = "11111111-1111-4111-8111-000000000001";

  beforeEach(() => {
    chamadas.length = 0;
    resposta = { data: null, error: null };
  });

  it("empresa: traduz as colunas e é buscada por usuario_id", async () => {
    resposta = {
      data: {
        usuario_id: ID,
        razao_social: "Agro Norte Ltda.",
        cnpj: "11222333000181",
        setor: "Agronegócio",
        porte: "Média",
        site: null,
        instagram: null,
        facebook: null,
        descricao: null,
        logo_url: "/avatares/cmp.svg",
        plano: "mensal",
      },
      error: null,
    };

    const e = await repo.perfilEmpresa(ID);
    expect(e).toEqual({
      usuarioId: ID,
      razaoSocial: "Agro Norte Ltda.",
      cnpj: "11222333000181",
      setor: "Agronegócio",
      porte: "Média",
      site: null,
      instagram: null,
      facebook: null,
      descricao: null,
      logoUrl: "/avatares/cmp.svg",
      plano: "mensal",
    });

    const filtro = chamadas.find((c) => c.metodo === "eq");
    expect(filtro?.args[0], "a chave da tabela é usuario_id").toBe(
      "usuario_id",
    );
  });

  it("prestador: números vêm como número, listas nunca vêm nulas", async () => {
    resposta = {
      data: {
        usuario_id: ID,
        categoria_id: "1",
        descricao: "Instalações elétricas.",
        preco_inicial: "150",
        anos_experiencia: "7",
        bairros_atendidos: null,
      },
      error: null,
    };

    const p = await repo.perfilPrestador(ID);
    expect(p?.categoriaId).toBe(1);
    expect(p?.precoInicial).toBe(150);
    expect(p?.anosExperiencia).toBe(7);
    expect(p?.bairrosAtendidos).toEqual([]);
  });

  /** Zero é valor; nulo é ausência. Confundir os dois some com o preço. */
  it("prestador: preço zero não vira nulo", async () => {
    resposta = {
      data: {
        usuario_id: ID,
        categoria_id: 1,
        descricao: null,
        preco_inicial: 0,
        anos_experiencia: 0,
        bairros_atendidos: [],
      },
      error: null,
    };

    const p = await repo.perfilPrestador(ID);
    expect(p?.precoInicial).toBe(0);
    expect(p?.anosExperiencia).toBe(0);
  });

  it("candidato: traduz formação e habilidades", async () => {
    resposta = {
      data: {
        usuario_id: ID,
        area_desejada: "Agronegócio",
        resumo: null,
        curriculo_url: null,
        disponibilidade: "Imediata",
        formacao: "Ensino médio completo",
        habilidades: ["CNH categoria C"],
      },
      error: null,
    };

    const c = await repo.perfilCandidato(ID);
    expect(c?.formacao).toBe("Ensino médio completo");
    expect(c?.habilidades).toEqual(["CNH categoria C"]);
  });

  it("perfil ausente devolve null, não objeto vazio", async () => {
    resposta = { data: null, error: null };
    expect(await repo.perfilEmpresa(ID)).toBeNull();
    expect(await repo.perfilPrestador(ID)).toBeNull();
    expect(await repo.perfilCandidato(ID)).toBeNull();
  });

  it("erro de banco vira indisponível, não silêncio", async () => {
    resposta = { data: null, error: { message: "conexão recusada" } };
    await expect(repo.perfilEmpresa(ID)).rejects.toMatchObject({
      codigo: "indisponivel",
    });
  });
});

describe("gravação de perfil", () => {
  const repo = new RepositorioPostgres();
  const ID = "11111111-1111-4111-8111-000000000001";

  beforeEach(() => {
    chamadas.length = 0;
    resposta = { data: null, error: null };
  });

  it("conta: escreve nas colunas em português", async () => {
    await repo.atualizarBasicos(ID, {
      nomeCompleto: "Ana Paula Ribeiro",
      telefone: "66999110005",
      bairro: "Centro",
    });

    const update = chamadas.find((c) => c.metodo === "update");
    expect(update?.tabela).toBe("usuarios");
    expect(update?.args[0]).toEqual({
      nome_completo: "Ana Paula Ribeiro",
      telefone: "66999110005",
      bairro: "Centro",
    });
  });

  /**
   * `upsert` e não `update`: conta criada antes de o campo existir chega
   * sem linha de perfil, e um `update` não afetaria nada — a tela diria
   * "salvo" sem ter salvo.
   */
  it("currículo: grava mesmo sem linha anterior", async () => {
    await repo.salvarPerfilCandidato(ID, {
      areaDesejada: "Agronegócio",
      resumo: null,
      formacao: "Ensino médio",
      habilidades: ["Trator"],
      disponibilidade: null,
      visivelParaEmpresas: false,
    });

    const upsert = chamadas.find((c) => c.metodo === "upsert");
    expect(upsert?.tabela).toBe("perfis_candidato");
    expect(upsert?.args[0]).toMatchObject({
      usuario_id: ID,
      area_desejada: "Agronegócio",
      formacao: "Ensino médio",
      habilidades: ["Trator"],
    });
    expect(upsert?.args[1]).toEqual({ onConflict: "usuario_id" });
  });

  it("anúncio: grava mesmo sem linha anterior", async () => {
    await repo.salvarPerfilPrestador(ID, {
      categoriaId: 1,
      descricao: "Instalações elétricas.",
      precoInicial: 150,
      anosExperiencia: 7,
      bairrosAtendidos: ["Centro"],
      instagram: null,
      facebook: null,
    });

    const upsert = chamadas.find((c) => c.metodo === "upsert");
    expect(upsert?.tabela).toBe("perfis_prestador");
    expect(upsert?.args[0]).toMatchObject({
      categoria_id: 1,
      preco_inicial: 150,
      anos_experiencia: 7,
      bairros_atendidos: ["Centro"],
    });
  });

  /**
   * Empresa usa `update`: a linha carrega o CNPJ, que não é editável, e
   * criar aqui exigiria inventar um. Empresa sem CNPJ é o que a plataforma
   * não pode ter.
   */
  it("empresa: atualiza sem criar e sem tocar no CNPJ", async () => {
    await repo.salvarPerfilEmpresa(ID, {
      razaoSocial: "Agro Norte S.A.",
      setor: "Agronegócio",
      porte: "Média",
      site: null,
      instagram: null,
      facebook: null,
      descricao: null,
    });

    expect(chamadas.some((c) => c.metodo === "upsert")).toBe(false);

    const update = chamadas.find((c) => c.metodo === "update");
    expect(update?.tabela).toBe("perfis_empresa");
    expect(Object.keys(update?.args[0] as object)).not.toContain("cnpj");
  });

  it("falha ao gravar não passa em silêncio", async () => {
    resposta = { data: null, error: { message: "conexão recusada" } };
    await expect(
      repo.atualizarBasicos(ID, {
        nomeCompleto: "X",
        telefone: "66999110005",
        bairro: null,
      }),
    ).rejects.toMatchObject({ codigo: "indisponivel" });
  });
});
