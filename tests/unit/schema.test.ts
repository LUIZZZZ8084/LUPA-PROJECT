/**
 * @vitest-environment node
 *
 * Executa `supabase/schema.sql` contra um Postgres de verdade (PGlite, o
 * Postgres compilado para WebAssembly) e exercita as regras que só existem
 * no banco.
 *
 * Existe porque schema não executado é schema que ninguém sabe se funciona.
 * O trigger de limite de publicações, por exemplo, usava
 * `select count(*) ... for update` — sintaxe que o Postgres recusa. Passou
 * por revisão de leitura sem ninguém notar; o primeiro `insert` real teria
 * quebrado em produção.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const SCHEMA = readFileSync(join(process.cwd(), "supabase/schema.sql"), "utf8");

let db: PGlite;

/** Cria um usuário e devolve o id. */
async function criarUsuario(
  papel: string,
  email: string,
  extras: { bairro?: string } = {},
) {
  const r = await db.query<{ id: string }>(
    `insert into usuarios (email, senha_hash, papel, nome_completo, telefone, bairro)
     values ($1, $2, $3::papel_usuario, $4, $5, $6) returning id`,
    [
      email,
      "$argon2id$v=19$m=19456,t=2,p=1$abc$def",
      papel,
      "Pessoa de Teste",
      "66999110001",
      extras.bairro ?? null,
    ],
  );
  return r.rows[0].id;
}

beforeAll(async () => {
  db = await PGlite.create();
  await db.exec(SCHEMA);
}, 60_000);

afterAll(async () => {
  await db?.close();
});

describe("schema.sql roda de uma vez num banco limpo", () => {
  it("cria todas as tabelas esperadas", async () => {
    const r = await db.query<{ table_name: string }>(
      `select table_name from information_schema.tables
       where table_schema = 'public' and table_type = 'BASE TABLE'
       order by table_name`,
    );
    const tabelas = r.rows.map((t) => t.table_name);

    expect(tabelas).toEqual([
      "admins",
      "avaliacoes",
      "candidaturas",
      "categorias_servico",
      "pedidos_verificacao",
      "perfis_candidato",
      "perfis_empresa",
      "perfis_prestador",
      "publicacoes",
      "usuarios",
      "vagas",
    ]);
  });

  it("cria as views que a aplicação consulta", async () => {
    const r = await db.query<{ table_name: string }>(
      `select table_name from information_schema.views
       where table_schema = 'public' order by table_name`,
    );
    const views = r.rows.map((v) => v.table_name);

    for (const esperada of [
      "job_listings",
      "provider_listings",
      "company_applications",
      "verification_queue",
      "metricas_totais",
      "metricas_cadastros_por_dia",
      "metricas_por_local",
      "metricas_planos",
    ]) {
      expect(views, `falta a view ${esperada}`).toContain(esperada);
    }
  });

  it("já vem com as sete categorias de serviço", async () => {
    const r = await db.query<{ total: string }>(
      "select count(*) as total from categorias_servico",
    );
    expect(Number(r.rows[0].total)).toBe(7);
  });

  it("liga RLS em todas as tabelas", async () => {
    const r = await db.query<{ relname: string }>(
      `select relname from pg_class
       where relnamespace = 'public'::regnamespace
         and relkind = 'r' and not relrowsecurity`,
    );
    expect(r.rows.map((t) => t.relname)).toEqual([]);
  });

  /**
   * A tabela guarda hash de senha. Com RLS ligada e nenhuma policy, o
   * Postgres nega tudo — é assim que ela fica fora do alcance da chave
   * anônima, que vai para o navegador.
   */
  it("usuarios não tem nenhuma policy, então nega por padrão", async () => {
    const r = await db.query<{ total: string }>(
      "select count(*) as total from pg_policies where tablename = 'usuarios'",
    );
    expect(Number(r.rows[0].total)).toBe(0);
  });

  it("currículo e candidaturas também ficam sem leitura pública", async () => {
    for (const tabela of [
      "perfis_candidato",
      "candidaturas",
      "pedidos_verificacao",
    ]) {
      const r = await db.query<{ total: string }>(
        "select count(*) as total from pg_policies where tablename = $1",
        [tabela],
      );
      expect(Number(r.rows[0].total), tabela).toBe(0);
    }
  });
});

describe("regras que só existem no banco", () => {
  it("e-mail é único ignorando maiúsculas", async () => {
    await criarUsuario("candidato_clt", "unico@teste.lupa");

    await expect(
      criarUsuario("candidato_clt", "UNICO@Teste.Lupa"),
    ).rejects.toThrow();
  });

  it("recusa telefone que não seja só dígitos", async () => {
    await expect(
      db.query(
        `insert into usuarios (email, senha_hash, papel, nome_completo, telefone)
         values ('mascara@teste.lupa', 'h', 'candidato_clt', 'X', '(66) 99911-0001')`,
      ),
    ).rejects.toThrow();
  });

  it("recusa e-mail sem arroba", async () => {
    await expect(
      db.query(
        `insert into usuarios (email, senha_hash, papel, nome_completo, telefone)
         values ('semarroba', 'h', 'candidato_clt', 'X', '66999110001')`,
      ),
    ).rejects.toThrow();
  });

  it("recusa vaga com teto de salário menor que o piso", async () => {
    const empresaId = await criarUsuario("empresa", "vaga@teste.lupa");
    await db.query(
      `insert into perfis_empresa (usuario_id, razao_social, cnpj)
       values ($1, 'Empresa', '11222333000181')`,
      [empresaId],
    );

    await expect(
      db.query(
        `insert into vagas (empresa_id, titulo, descricao, salario_min, salario_max)
         values ($1, 'Cargo', 'Descrição', 5000, 2000)`,
        [empresaId],
      ),
    ).rejects.toThrow();
  });

  it("uma pessoa não se candidata duas vezes à mesma vaga", async () => {
    const empresaId = await criarUsuario("empresa", "dupla@teste.lupa");
    await db.query(
      `insert into perfis_empresa (usuario_id, razao_social, cnpj)
       values ($1, 'Empresa Dupla', '11444777000161')`,
      [empresaId],
    );
    const vaga = await db.query<{ id: string }>(
      `insert into vagas (empresa_id, titulo, descricao)
       values ($1, 'Cargo', 'Descrição') returning id`,
      [empresaId],
    );
    const candidatoId = await criarUsuario("candidato_clt", "cand@teste.lupa");

    await db.query(
      "insert into candidaturas (vaga_id, candidato_id) values ($1, $2)",
      [vaga.rows[0].id, candidatoId],
    );

    await expect(
      db.query(
        "insert into candidaturas (vaga_id, candidato_id) values ($1, $2)",
        [vaga.rows[0].id, candidatoId],
      ),
    ).rejects.toThrow();
  });

  it("a nota do prestador é recalculada pelo trigger", async () => {
    const prestadorId = await criarUsuario("prestador_servico", "p@teste.lupa");
    await db.query(
      "insert into perfis_prestador (usuario_id, categoria_id) values ($1, 1)",
      [prestadorId],
    );

    for (const nota of [5, 4, 5]) {
      await db.query(
        "insert into avaliacoes (prestador_id, nome_avaliador, nota) values ($1, 'Cliente', $2)",
        [prestadorId, nota],
      );
    }

    const r = await db.query<{ nota_media: string; total_avaliacoes: number }>(
      "select nota_media, total_avaliacoes from perfis_prestador where usuario_id = $1",
      [prestadorId],
    );

    expect(Number(r.rows[0].nota_media)).toBeCloseTo(4.7, 1);
    expect(r.rows[0].total_avaliacoes).toBe(3);
  });

  it("apagar avaliação também recalcula", async () => {
    const prestadorId = await criarUsuario(
      "prestador_servico",
      "p2@teste.lupa",
    );
    await db.query(
      "insert into perfis_prestador (usuario_id, categoria_id) values ($1, 2)",
      [prestadorId],
    );
    await db.query(
      "insert into avaliacoes (prestador_id, nome_avaliador, nota) values ($1, 'C', 5)",
      [prestadorId],
    );
    await db.query("delete from avaliacoes where prestador_id = $1", [
      prestadorId,
    ]);

    const r = await db.query<{ total_avaliacoes: number }>(
      "select total_avaliacoes from perfis_prestador where usuario_id = $1",
      [prestadorId],
    );
    expect(r.rows[0].total_avaliacoes).toBe(0);
  });

  it("recusa nota fora de 1 a 5", async () => {
    const prestadorId = await criarUsuario(
      "prestador_servico",
      "p3@teste.lupa",
    );

    await expect(
      db.query(
        "insert into avaliacoes (prestador_id, nome_avaliador, nota) values ($1, 'C', 6)",
        [prestadorId],
      ),
    ).rejects.toThrow();
  });
});

describe("limite de publicações, imposto pelo banco", () => {
  let autorId: string;

  beforeAll(async () => {
    autorId = await criarUsuario("prestador_servico", "autor@teste.lupa");
  });

  async function publicar(n: number) {
    return db.query(
      `insert into publicacoes (autor_id, titulo, corpo)
       values ($1, $2, 'Corpo com tamanho suficiente para o check.')`,
      [autorId, `Publicação número ${n}`],
    );
  }

  it("aceita exatamente dez", async () => {
    for (let i = 1; i <= 10; i++) await publicar(i);

    const r = await db.query<{ total: string }>(
      "select count(*) as total from publicacoes where autor_id = $1 and status = 'ativa'",
      [autorId],
    );
    expect(Number(r.rows[0].total)).toBe(10);
  });

  /** A regra que a aplicação sozinha não consegue garantir sob concorrência. */
  it("recusa a décima primeira", async () => {
    await expect(publicar(11)).rejects.toThrow(/limite de 10/);
  });

  it("arquivar abre espaço", async () => {
    await db.query(
      `update publicacoes set status = 'arquivada'
       where autor_id = $1 and titulo = 'Publicação número 1'`,
      [autorId],
    );

    await expect(publicar(11)).resolves.toBeTruthy();
  });

  /** Senão, arquivar viraria um jeito de manter vinte e alternar quais aparecem. */
  it("reativar também passa pelo limite", async () => {
    await expect(
      db.query(
        `update publicacoes set status = 'ativa'
         where autor_id = $1 and titulo = 'Publicação número 1'`,
        [autorId],
      ),
    ).rejects.toThrow(/limite de 10/);
  });

  it("o limite é por perfil, não global", async () => {
    const outro = await criarUsuario("empresa", "outro-autor@teste.lupa");
    await expect(
      db.query(
        `insert into publicacoes (autor_id, titulo, corpo)
         values ($1, 'Primeira dele', 'Corpo com tamanho suficiente.')`,
        [outro],
      ),
    ).resolves.toBeTruthy();
  });

  it("recusa título ou corpo curto demais", async () => {
    const outro = await criarUsuario("empresa", "curto@teste.lupa");

    await expect(
      db.query(
        "insert into publicacoes (autor_id, titulo, corpo) values ($1, 'ab', 'Corpo suficiente aqui.')",
        [outro],
      ),
    ).rejects.toThrow();

    await expect(
      db.query(
        "insert into publicacoes (autor_id, titulo, corpo) values ($1, 'Título bom', 'curto')",
        [outro],
      ),
    ).rejects.toThrow();
  });
});

describe("views devolvem o formato que a aplicação espera", () => {
  it("provider_listings traz a categoria como objeto", async () => {
    const r = await db.query<{
      full_name: string;
      category: { id: number; slug: string; name: string };
      phone: string;
    }>("select * from provider_listings limit 1");

    expect(r.rows.length).toBeGreaterThan(0);
    expect(r.rows[0].category).toMatchObject({ slug: expect.any(String) });
  });

  /** Nenhuma view pode expor o hash, nem por descuido de `select *`. */
  it("nenhuma view expõe senha_hash", async () => {
    const r = await db.query<{ table_name: string }>(
      `select table_name from information_schema.columns
       where table_schema = 'public' and column_name like '%senha%'
         and table_name in (select table_name from information_schema.views
                            where table_schema = 'public')`,
    );
    expect(r.rows).toEqual([]);
  });

  it("job_listings traz a empresa embutida e a contagem de candidatos", async () => {
    const r = await db.query<{
      company: { company_name: string };
      applicant_count: string;
    }>("select * from job_listings limit 1");

    expect(r.rows[0].company).toMatchObject({
      company_name: expect.any(String),
    });
    expect(Number(r.rows[0].applicant_count)).toBeGreaterThanOrEqual(0);
  });

  it("metricas_totais responde com números", async () => {
    const r = await db.query<{ usuarios: string; vagas_abertas: string }>(
      "select * from metricas_totais",
    );
    expect(Number(r.rows[0].usuarios)).toBeGreaterThan(0);
  });

  it("metricas_por_local agrupa por cidade e bairro", async () => {
    await criarUsuario("candidato_clt", "local@teste.lupa", {
      bairro: "Centro",
    });

    const r = await db.query<{ cidade: string; bairro: string; total: string }>(
      "select * from metricas_por_local where bairro = 'Centro'",
    );
    expect(Number(r.rows[0].total)).toBeGreaterThan(0);
  });

  it("metricas_cadastros_por_dia usa o fuso de Sinop, não UTC", async () => {
    const r = await db.query<{ dia: string }>(
      "select dia from metricas_cadastros_por_dia limit 1",
    );
    expect(r.rows[0].dia).toBeTruthy();
  });
});

/**
 * `company_applications`, `verification_queue` e as views `metricas_*`
 * juntam tabelas sem policy de select para `anon` (`usuarios`,
 * `candidaturas`, `pedidos_verificacao`). Como são criadas com
 * `security_invoker = false`, o Postgres avalia RLS como quem criou a
 * view — sem a revogação explícita, `anon` leria currículo, telefone e
 * nome de quem pediu verificação direto pela API REST do Supabase, mesmo
 * sem nenhuma policy de select nas tabelas de baixo. GRANT é independente
 * de RLS, e o schema agora declara os dois lados em vez de confiar no que
 * a plataforma concede por fora.
 */
describe("grants de anon e authenticated", () => {
  const NUNCA_PUBLICAS = [
    "usuarios",
    "admins",
    "perfis_candidato",
    "candidaturas",
    "pedidos_verificacao",
    "company_applications",
    "verification_queue",
    "metricas_totais",
    "metricas_cadastros_por_dia",
    "metricas_por_local",
    "metricas_planos",
  ];

  const PUBLICAS_DE_PROPOSITO = [
    "categorias_servico",
    "perfis_prestador",
    "perfis_empresa",
    "avaliacoes",
    "vagas",
    "publicacoes",
    "job_listings",
    "provider_listings",
  ];

  it.each(NUNCA_PUBLICAS)("anon não lê %s", async (tabela) => {
    const r = await db.query<{ tem_acesso: boolean }>(
      `select has_table_privilege('anon', $1, 'SELECT') as tem_acesso`,
      [tabela],
    );
    expect(r.rows[0].tem_acesso).toBe(false);
  });

  it.each(NUNCA_PUBLICAS)("authenticated não lê %s", async (tabela) => {
    const r = await db.query<{ tem_acesso: boolean }>(
      `select has_table_privilege('authenticated', $1, 'SELECT') as tem_acesso`,
      [tabela],
    );
    expect(r.rows[0].tem_acesso).toBe(false);
  });

  it.each(PUBLICAS_DE_PROPOSITO)(
    "anon continua lendo %s — a revogação não é geral demais",
    async (tabela) => {
      const r = await db.query<{ tem_acesso: boolean }>(
        `select has_table_privilege('anon', $1, 'SELECT') as tem_acesso`,
        [tabela],
      );
      expect(r.rows[0].tem_acesso).toBe(true);
    },
  );
});

/**
 * O seed roda contra o mesmo Postgres, num banco separado.
 *
 * Seed que não executa é seed que falha na primeira vez que alguém precisa
 * dele — normalmente no meio de uma demonstração.
 */
describe("seed.sql popula Sinop sem erro", () => {
  let banco: PGlite;

  beforeAll(async () => {
    banco = await PGlite.create();
    await banco.exec(SCHEMA);
    await banco.exec(
      readFileSync(join(process.cwd(), "supabase/seed.sql"), "utf8"),
    );
  }, 60_000);

  afterAll(async () => {
    await banco?.close();
  });

  it("cria prestadores, empresas e candidatos", async () => {
    const r = await banco.query<{ papel: string; total: string }>(
      "select papel::text, count(*) as total from usuarios group by papel order by papel",
    );
    const porPapel = Object.fromEntries(
      r.rows.map((l) => [l.papel, Number(l.total)]),
    );

    expect(porPapel.prestador_servico).toBe(9);
    expect(porPapel.empresa).toBe(3);
    expect(porPapel.candidato_clt).toBe(2);
  });

  it("as notas foram calculadas pelo trigger, não escritas à mão", async () => {
    const r = await banco.query<{ nota_media: string; total: number }>(
      `select nota_media, total_avaliacoes as total from perfis_prestador
       where usuario_id = '11111111-1111-4111-8111-000000000001'`,
    );

    // 5, 5 e 4 → 4,7
    expect(Number(r.rows[0].nota_media)).toBeCloseTo(4.7, 1);
    expect(r.rows[0].total).toBe(3);
  });

  it("provider_listings devolve os nove prestadores com categoria", async () => {
    const r = await banco.query<{
      full_name: string;
      category: { slug: string };
      avatar_url: string;
    }>("select * from provider_listings order by full_name");

    expect(r.rows).toHaveLength(9);
    expect(r.rows.every((p) => p.category?.slug)).toBe(true);
    // Todo perfil de exemplo tem avatar; a plataforma não abre sem rosto.
    expect(r.rows.every((p) => p.avatar_url?.startsWith("/avatares/"))).toBe(
      true,
    );
  });

  it("job_listings traz empresa e contagem de candidatos", async () => {
    const r = await banco.query<{
      title: string;
      company: { company_name: string };
      applicant_count: string;
    }>("select * from job_listings order by created_at desc");

    expect(r.rows).toHaveLength(5);
    expect(r.rows[0].company.company_name).toBeTruthy();

    const comCandidato = r.rows.filter((v) => Number(v.applicant_count) > 0);
    expect(comCandidato.length).toBe(2);
  });

  it("a fila de verificação traz quem ainda não foi aprovado", async () => {
    const r = await banco.query<{ full_name: string; category: string }>(
      "select * from verification_queue where status = 'em_analise'",
    );

    expect(r.rows).toHaveLength(2);
    // A view resolve a categoria do prestador pelo join.
    expect(r.rows.some((p) => p.category)).toBe(true);
  });

  it("as métricas respondem com a base do seed", async () => {
    const r = await banco.query<{
      usuarios: string;
      prestadores: string;
      vagas_abertas: string;
    }>("select * from metricas_totais");

    expect(Number(r.rows[0].usuarios)).toBe(14);
    expect(Number(r.rows[0].prestadores)).toBe(9);
    expect(Number(r.rows[0].vagas_abertas)).toBe(5);
  });

  it("nenhum perfil de exemplo fica sem avatar", async () => {
    const r = await banco.query<{ total: string }>(
      "select count(*) as total from usuarios where avatar_url is null",
    );
    expect(Number(r.rows[0].total)).toBe(0);
  });
});

/**
 * O `schema.sql` é feito para rodar em banco limpo. Rodado duas vezes, ele
 * para em `type "papel_usuario" already exists` — o que aconteceu de
 * verdade na primeira tentativa de ligar o Supabase.
 *
 * O `reset.sql` é o caminho de volta. O que este bloco prova não é que ele
 * roda sem erro, e sim que ele apaga o suficiente: depois dele, o schema
 * sobe outra vez como se o banco nunca tivesse sido tocado. O jeito de
 * errar aqui é esquecer um objeto que não pertence a nenhuma tabela — as
 * funções de trigger e os tipos enum sobrevivem a `drop table cascade`.
 */
describe("reset.sql devolve o banco ao estado limpo", () => {
  const RESET = readFileSync(join(process.cwd(), "supabase/reset.sql"), "utf8");

  let banco: PGlite;

  beforeAll(async () => {
    banco = await PGlite.create();
  }, 60_000);

  afterAll(async () => {
    await banco?.close();
  });

  it("o schema recusa a segunda execução — é o problema que o reset resolve", async () => {
    await banco.exec(SCHEMA);
    await expect(banco.exec(SCHEMA)).rejects.toThrow(/already exists/);
  });

  it("depois do reset, o schema sobe de novo inteiro", async () => {
    await banco.exec(RESET);
    await banco.exec(SCHEMA);

    const tabelas = await banco.query<{ table_name: string }>(
      `select table_name from information_schema.tables
       where table_schema = 'public' and table_type = 'BASE TABLE'
       order by table_name`,
    );
    expect(tabelas.rows).toHaveLength(11);

    const views = await banco.query<{ total: string }>(
      `select count(*) as total from information_schema.views
       where table_schema = 'public'`,
    );
    expect(Number(views.rows[0].total)).toBe(8);
  });

  it("não sobra tipo, função nem view órfã", async () => {
    await banco.exec(RESET);

    const tipos = await banco.query<{ typname: string }>(
      `select typname from pg_type
       where typnamespace = 'public'::regnamespace and typtype = 'e'`,
    );
    expect(tipos.rows.map((t) => t.typname)).toEqual([]);

    const funcoes = await banco.query<{ proname: string }>(
      `select proname from pg_proc
       where pronamespace = 'public'::regnamespace`,
    );
    expect(funcoes.rows.map((f) => f.proname)).toEqual([]);

    const views = await banco.query<{ table_name: string }>(
      `select table_name from information_schema.views
       where table_schema = 'public'`,
    );
    expect(views.rows).toEqual([]);
  });

  /** Rodar o reset num banco que já está limpo não pode explodir. */
  it("o reset é seguro de rodar duas vezes", async () => {
    await banco.exec(RESET);
    await expect(banco.exec(RESET)).resolves.toBeDefined();
  });

  it("o seed volta a rodar depois do ciclo completo", async () => {
    await banco.exec(SCHEMA);
    await banco.exec(
      readFileSync(join(process.cwd(), "supabase/seed.sql"), "utf8"),
    );

    const r = await banco.query<{ total: string }>(
      "select count(*) as total from usuarios",
    );
    expect(Number(r.rows[0].total)).toBe(14);
  });
});
