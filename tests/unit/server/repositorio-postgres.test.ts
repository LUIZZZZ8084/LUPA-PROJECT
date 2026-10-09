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

  /*
   * `gte` e `limit` entraram com os cortes de sessão (#225), e a lição é a
   * mesma que a #203 já cobrou: duble de consulta sem o método que o
   * repositório chama reprova sem ser defeito — e falso vermelho é o que
   * ensina todo mundo a ignorar teste. Método de consulta novo entra aqui
   * junto.
   */
  for (const metodo of [
    "select",
    "eq",
    "gte",
    "order",
    "is",
    "limit",
    "insert",
    "update",
    "upsert",
  ]) {
    builder[metodo] = (...args: unknown[]) => {
      chamadas.push({ tabela, metodo, args });
      return builder;
    };
  }

  return builder;
}

vi.mock("@/lib/supabase/service", () => ({
  temChaveDeServico: true,
  clienteDeServico: () => ({
    from: (tabela: string) => construtor(tabela),
    rpc: (funcao: string, args: unknown) => {
      chamadas.push({ tabela: `rpc:${funcao}`, metodo: "rpc", args: [args] });
      return Promise.resolve(resposta);
    },
  }),
}));

import { TETO_DE_CORTES_DE_SESSAO } from "@/lib/limites-de-lista";
import { log } from "@/server/logger";
import { RepositorioPostgres } from "@/server/repositories/postgres";

const LINHA = {
  id: "11111111-1111-4111-8111-000000000001",
  email: "joao@teste.lupa",
  senha_hash: "$argon2id$v=19$m=19456,t=2,p=1$abc$def",
  papel: "prestador_servico",
  nome_completo: "João Silva",
  telefone: "66999110001",
  cidade: "Sinop - MT",
  // A coluna continua no banco (#321), com o que as contas antigas
  // informaram — e o mapeamento a ignora, como o teste abaixo confere.
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
      // Nulo para quem não é prestador — que é a esmagadora maioria.
      cpf: null,
      telefone: "66999110001",
      cidade: "Sinop - MT",
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
      cidade: "Sinop - MT",
    });

    const insert = chamadas.find((c) => c.metodo === "insert");
    expect(insert?.tabela).toBe("usuarios");
    expect(insert?.args[0]).toMatchObject({
      email: "joao@teste.lupa",
      senha_hash: "hash",
      nome_completo: "João Silva",
      cidade: "Sinop - MT",
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
        cidade: "Sinop - MT",
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
      instagram: null,
      facebook: null,
      cnpj: null,
      cnpjVerificado: false,
      razaoSocial: null,
      mensalidadeValidaAte: null,
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
      experiencias: [],
      visivelParaEmpresas: false,
      geradorCurriculoLiberado: false,
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

  /**
   * A senha e o corte de sessão vão na **mesma instrução** (#225).
   *
   * Duas instruções deixariam uma janela em que a senha já mudou e as
   * sessões antigas ainda valem — e, pior, deixariam alguém escrever um
   * terceiro caminho de troca de senha chamando só a primeira. É a lição
   * da #142: quando duas funções produzem o mesmo efeito por caminhos
   * diferentes, a regra corrigida numa provavelmente falta na outra.
   *
   * Este teste reprovou de verdade quando o corte entrou, e é para isso
   * que ele serve: escrita de senha que deixe de revogar tem que ficar
   * vermelha.
   */
  it("atualizarSenhaHash grava a senha e o corte de sessão juntos", async () => {
    const antes = Date.now();
    await repo.atualizarSenhaHash("u1", "novo-hash");

    const update = chamadas.find((c) => c.metodo === "update");
    const gravado = update?.args[0] as {
      senha_hash: string;
      sessoes_validas_desde: string;
    };

    expect(gravado.senha_hash).toBe("novo-hash");
    expect(
      new Date(gravado.sessoes_validas_desde).getTime(),
    ).toBeGreaterThanOrEqual(antes);
    expect(Object.keys(gravado).sort()).toEqual([
      "senha_hash",
      "sessoes_validas_desde",
    ]);
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

  it("prestador: números vêm como número", async () => {
    resposta = {
      data: {
        usuario_id: ID,
        categoria_id: "1",
        descricao: "Instalações elétricas.",
        preco_inicial: "150",
        anos_experiencia: "7",
      },
      error: null,
    };

    const p = await repo.perfilPrestador(ID);
    expect(p?.categoriaId).toBe(1);
    expect(p?.precoInicial).toBe(150);
    expect(p?.anosExperiencia).toBe(7);
  });

  it("prestador: traz a validade da mensalidade", async () => {
    resposta = {
      data: {
        usuario_id: ID,
        categoria_id: 1,
        descricao: null,
        preco_inicial: null,
        anos_experiencia: null,
        mensalidade_valida_ate: "2026-10-01T00:00:00.000Z",
      },
      error: null,
    };

    const p = await repo.perfilPrestador(ID);
    expect(p?.mensalidadeValidaAte).toBe("2026-10-01T00:00:00.000Z");
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
      },
      error: null,
    };

    const p = await repo.perfilPrestador(ID);
    expect(p?.precoInicial).toBe(0);
    expect(p?.anosExperiencia).toBe(0);
  });

  it("candidato: traduz formação, habilidades e o gerador de currículo", async () => {
    resposta = {
      data: {
        usuario_id: ID,
        area_desejada: "Agronegócio",
        resumo: null,
        curriculo_url: null,
        disponibilidade: "Imediata",
        formacao: "Ensino médio completo",
        habilidades: ["CNH categoria C"],
        experiencias: [
          { role: "Operador", company: "Agro Norte", period: "2021 — 2023" },
        ],
        gerador_curriculo_liberado: true,
      },
      error: null,
    };

    const c = await repo.perfilCandidato(ID);
    expect(c?.formacao).toBe("Ensino médio completo");
    expect(c?.habilidades).toEqual(["CNH categoria C"]);
    expect(c?.experiencias).toEqual([
      { role: "Operador", company: "Agro Norte", period: "2021 — 2023" },
    ]);
    expect(c?.geradorCurriculoLiberado).toBe(true);
  });

  /** Coluna nula vira lista vazia, não `undefined` — mesma régua de habilidades. */
  it("candidato: sem experiência gravada, devolve lista vazia", async () => {
    resposta = {
      data: {
        usuario_id: ID,
        area_desejada: null,
        resumo: null,
        curriculo_url: null,
        disponibilidade: null,
        formacao: null,
        habilidades: null,
        experiencias: null,
      },
      error: null,
    };

    const c = await repo.perfilCandidato(ID);
    expect(c?.experiencias).toEqual([]);
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
    await repo.atualizarBasicos(ID, { telefone: "66999110005" });

    const update = chamadas.find((c) => c.metodo === "update");
    expect(update?.tabela).toBe("usuarios");
    // Sem `nome_completo`: o nome não se edita no perfil (#315).
    expect(update?.args[0]).toEqual({ telefone: "66999110005" });
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
      experiencias: [
        { role: "Operador", company: "Agro Norte", period: "2021 — 2023" },
      ],
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
      experiencias: [
        { role: "Operador", company: "Agro Norte", period: "2021 — 2023" },
      ],
    });
    expect(upsert?.args[1]).toEqual({ onConflict: "usuario_id" });
  });

  it("anúncio: grava mesmo sem linha anterior", async () => {
    await repo.salvarPerfilPrestador(ID, {
      categoriaId: 1,
      descricao: "Instalações elétricas.",
      precoInicial: 150,
      anosExperiencia: 7,
      instagram: null,
      facebook: null,
    });

    const upsert = chamadas.find((c) => c.metodo === "upsert");
    expect(upsert?.tabela).toBe("perfis_prestador");
    expect(upsert?.args[0]).toMatchObject({
      categoria_id: 1,
      preco_inicial: 150,
      anos_experiencia: 7,
    });
    expect(Object.keys(upsert?.args[0] as object)).not.toContain(
      "bairros_atendidos",
    );
  });

  /**
   * Empresa usa `update`: a linha carrega o CNPJ, que não é editável, e
   * criar aqui exigiria inventar um. Empresa sem CNPJ é o que a plataforma
   * não pode ter.
   */
  it("empresa: atualiza sem criar e sem tocar no CNPJ nem no nome", async () => {
    await repo.salvarPerfilEmpresa(ID, {
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
    expect(Object.keys(update?.args[0] as object)).not.toContain(
      "razao_social",
    );
  });

  /** A única troca de nome de empresa que existe: a da Receita (#315). */
  it("empresa: a razão social da Receita grava só o nome", async () => {
    await repo.definirRazaoSocialDaReceita(ID, "AGRO NORTE LTDA");

    const update = chamadas.find((c) => c.metodo === "update");
    expect(update?.tabela).toBe("perfis_empresa");
    expect(update?.args[0]).toEqual({ razao_social: "AGRO NORTE LTDA" });
  });

  it("empresa: falha ao gravar a razão social não passa em silêncio", async () => {
    resposta = { data: null, error: { message: "conexão recusada" } };
    await expect(
      repo.definirRazaoSocialDaReceita(ID, "AGRO NORTE LTDA"),
    ).rejects.toMatchObject({ codigo: "indisponivel" });
  });

  it("prestador: grava a validade da mensalidade", async () => {
    await repo.definirMensalidadeValidaAte(ID, "2026-10-01T00:00:00.000Z");

    const update = chamadas.find((c) => c.metodo === "update");
    expect(update?.tabela).toBe("perfis_prestador");
    expect(update?.args[0]).toEqual({
      mensalidade_valida_ate: "2026-10-01T00:00:00.000Z",
    });
  });

  it("prestador: estende a mensalidade pela função atômica do banco", async () => {
    resposta = { data: [LINHA], error: null };

    const estendeu = await repo.estenderMensalidadePrestador(ID, 30);

    expect(estendeu).toBe(true);
    const rpc = chamadas.find((c) => c.metodo === "rpc");
    expect(rpc?.tabela).toBe("rpc:estender_mensalidade_prestador");
    expect(rpc?.args[0]).toEqual({ p_usuario: ID, p_dias: 30 });
  });

  it("prestador: revogar manda p_dias nulo pela mesma função", async () => {
    resposta = { data: [LINHA], error: null };

    await repo.estenderMensalidadePrestador(ID, null);

    const rpc = chamadas.find((c) => c.metodo === "rpc");
    expect(rpc?.args[0]).toEqual({ p_usuario: ID, p_dias: null });
  });

  it("prestador: sem linha devolvida, a extensão foi para quem não tem perfil", async () => {
    resposta = { data: [], error: null };

    expect(await repo.estenderMensalidadePrestador(ID, 30)).toBe(false);
  });

  it("candidato: liga e desliga o gerador de currículo", async () => {
    await repo.definirGeradorCurriculoLiberado(ID, true);

    const update = chamadas.find((c) => c.metodo === "update");
    expect(update?.tabela).toBe("perfis_candidato");
    expect(update?.args[0]).toEqual({ gerador_curriculo_liberado: true });
  });

  it("falha ao gravar não passa em silêncio", async () => {
    resposta = { data: null, error: { message: "conexão recusada" } };
    await expect(
      repo.atualizarBasicos(ID, { telefone: "66999110005" }),
    ).rejects.toMatchObject({ codigo: "indisponivel" });
  });
});

/**
 * A lista de cortes de sessão, no Postgres (#225).
 *
 * O que importa aqui é ser **uma consulta filtrada por tempo**, e não uma
 * pergunta por pessoa: perguntar "esta sessão vale?" a cada requisição
 * seria a consulta por requisição que manteve a sessão fora do banco desde
 * o começo. E o `.limit()` é a disciplina da #203 — consulta de lista sem
 * teto é a que fica cara em silêncio.
 */
describe("cortes de sessão", () => {
  const repo = new RepositorioPostgres();

  beforeEach(() => {
    chamadas.length = 0;
  });

  it("pede só a janela, com teto, e devolve epoch em segundos", async () => {
    const quando = new Date("2026-09-10T12:00:00.000Z");
    resposta = {
      data: [{ id: "u1", sessoes_validas_desde: quando.toISOString() }],
      error: null,
    };

    const cortes = await repo.cortesDeSessao(7);

    expect(cortes.get("u1")).toBe(Math.floor(quando.getTime() / 1000));

    const filtro = chamadas.find((c) => c.metodo === "gte");
    expect(filtro?.args[0]).toBe("sessoes_validas_desde");

    expect(chamadas.some((c) => c.metodo === "limit")).toBe(true);
  });

  it("tem teto próprio e ordena do corte mais novo (#352)", async () => {
    resposta = { data: [], error: null };
    await repo.cortesDeSessao(7);

    expect(chamadas.find((c) => c.metodo === "limit")?.args[0]).toBe(
      TETO_DE_CORTES_DE_SESSAO,
    );
    const ordem = chamadas.find((c) => c.metodo === "order");
    expect(ordem?.args[0]).toBe("sessoes_validas_desde");
    expect(ordem?.args[1]).toEqual({ ascending: false });
  });

  it("chegar ao teto vai ao Sentry, e abaixo dele não faz barulho (#352)", async () => {
    const erro = vi.spyOn(log, "erro").mockImplementation(() => {});
    const linha = (i: number) => ({
      id: `u${i}`,
      sessoes_validas_desde: "2026-09-10T12:00:00.000Z",
    });

    resposta = { data: [linha(1)], error: null };
    await repo.cortesDeSessao(7);
    expect(erro).not.toHaveBeenCalled();

    resposta = {
      data: Array.from({ length: TETO_DE_CORTES_DE_SESSAO }, (_, i) =>
        linha(i),
      ),
      error: null,
    };
    await repo.cortesDeSessao(7);
    expect(erro).toHaveBeenCalledTimes(1);
    erro.mockRestore();
  });

  it("a troca de papel grava o corte na mesma instrução (#352)", async () => {
    await repo.atualizarPapel(
      "11111111-1111-4111-8111-000000000001",
      "prestador_servico",
    );

    const update = chamadas.find((c) => c.metodo === "update");
    expect(update?.tabela).toBe("usuarios");
    const gravado = update?.args[0] as Record<string, unknown>;
    expect(gravado.papel).toBe("prestador_servico");
    expect(typeof gravado.sessoes_validas_desde).toBe("string");
  });

  it("ninguém trocou a senha esta semana: lista vazia, não erro", async () => {
    resposta = { data: [], error: null };
    expect((await repo.cortesDeSessao(7)).size).toBe(0);
  });
});

/**
 * O teste grátis é um por conta (#392).
 *
 * A reivindicação é uma instrução só, com `is null` na condição: duas
 * ativações simultâneas leriam as duas "não usou" se fosse ler e depois
 * gravar.
 */
describe("teste grátis", () => {
  const repo = new RepositorioPostgres();
  const ID = "11111111-1111-4111-8111-000000000001";

  beforeEach(() => {
    chamadas.length = 0;
  });

  it("já usado: lê a coluna e responde verdadeiro", async () => {
    resposta = {
      data: { teste_gratis_usado_em: "2026-10-01T00:00:00Z" },
      error: null,
    };
    expect(await repo.testeGratisJaUsado(ID)).toBe(true);
    expect(chamadas.find((c) => c.metodo === "select")?.args[0]).toBe(
      "teste_gratis_usado_em",
    );
  });

  it("nunca usado, ou sem linha: falso", async () => {
    resposta = { data: { teste_gratis_usado_em: null }, error: null };
    expect(await repo.testeGratisJaUsado(ID)).toBe(false);
    resposta = { data: null, error: null };
    expect(await repo.testeGratisJaUsado(ID)).toBe(false);
  });

  it("reivindicar: uma instrução com is null, e devolve quem levou", async () => {
    resposta = { data: { id: ID }, error: null };
    expect(await repo.reivindicarTesteGratis(ID)).toBe(true);

    const atualizacao = chamadas.find((c) => c.metodo === "update");
    expect(atualizacao?.tabela).toBe("usuarios");
    const gravado = atualizacao?.args[0] as Record<string, unknown>;
    expect(typeof gravado.teste_gratis_usado_em).toBe("string");
    expect(chamadas.find((c) => c.metodo === "is")?.args).toEqual([
      "teste_gratis_usado_em",
      null,
    ]);
  });

  it("reivindicar quando já foi usado: zero linhas, falso", async () => {
    resposta = { data: null, error: null };
    expect(await repo.reivindicarTesteGratis(ID)).toBe(false);
  });

  it("falha no banco não passa em silêncio", async () => {
    resposta = { data: null, error: { message: "conexão caiu" } };
    await expect(repo.testeGratisJaUsado(ID)).rejects.toMatchObject({
      codigo: "indisponivel",
    });
    await expect(repo.reivindicarTesteGratis(ID)).rejects.toMatchObject({
      codigo: "indisponivel",
    });
  });
});

/** Sair dos outros aparelhos grava só o corte, e não a senha (#402). */
describe("corte de sessões pelo dono", () => {
  const repo = new RepositorioPostgres();
  const ID = "11111111-1111-4111-8111-000000000001";

  beforeEach(() => {
    chamadas.length = 0;
    resposta = { data: null, error: null };
  });

  it("grava sessoes_validas_desde, e nada mais", async () => {
    await repo.cortarSessoes(ID);

    const update = chamadas.find((c) => c.metodo === "update");
    expect(update?.tabela).toBe("usuarios");
    expect(Object.keys(update?.args[0] as object)).toEqual([
      "sessoes_validas_desde",
    ]);
    expect(chamadas.find((c) => c.metodo === "eq")?.args).toEqual(["id", ID]);
  });

  it("falha ao gravar não passa em silêncio", async () => {
    resposta = { data: null, error: { message: "conexão recusada" } };
    await expect(repo.cortarSessoes(ID)).rejects.toMatchObject({
      codigo: "indisponivel",
    });
  });
});
