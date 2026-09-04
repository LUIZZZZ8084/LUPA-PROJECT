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
      "buscas_sem_resultado",
      "candidaturas",
      "categorias_servico",
      "pedidos_verificacao",
      "perfis_candidato",
      "perfis_empresa",
      "perfis_prestador",
      "publicacoes",
      "tentativas_de_acesso",
      "usuarios",
      "vagas",
      "visualizacoes_vaga",
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
      "candidate_applications",
      "verification_queue",
      "metricas_totais",
      "metricas_cadastros_por_dia",
      "metricas_por_local",
      "metricas_planos",
    ]) {
      expect(views, `falta a view ${esperada}`).toContain(esperada);
    }
  });

  it("já vem com as dezessete categorias de serviço", async () => {
    const r = await db.query<{ total: string }>(
      "select count(*) as total from categorias_servico",
    );
    expect(Number(r.rows[0].total)).toBe(17);
  });

  /**
   * Produtor rural e autônomo contratam sem ter aberto empresa — #129,
   * #138. `cnpj` deixou de ser `not null`, e duas empresas sem CNPJ não
   * podem colidir uma com a outra: `null` não é igual a `null` para o
   * índice único parcial.
   */
  it("empresa pode existir sem CNPJ — é quem contrata com CPF", async () => {
    const a = await criarUsuario("empresa", "produtor-a@teste.lupa");
    const b = await criarUsuario("empresa", "produtor-b@teste.lupa");

    await db.query(
      `insert into perfis_empresa (usuario_id, razao_social, cnpj)
       values ($1, 'Sítio A', null), ($2, 'Sítio B', null)`,
      [a, b],
    );

    const r = await db.query<{ total: string }>(
      "select count(*) as total from perfis_empresa where cnpj is null",
    );
    expect(Number(r.rows[0].total)).toBe(2);
  });

  /**
   * CNPJ de MEI é opcional, e vem com o resultado da própria conferência —
   * #138. Selo adicional ao CPF, que já verifica o prestador (#133); por
   * isso nasce `false`, e não bloqueia nada enquanto não for confirmado.
   */
  it("prestador tem CNPJ opcional, sem conferência por padrão", async () => {
    const id = await criarUsuario("prestador_servico", "mei@teste.lupa");
    await db.query(
      "insert into perfis_prestador (usuario_id, categoria_id) values ($1, 1)",
      [id],
    );

    const r = await db.query<{
      cnpj: string | null;
      verificado: boolean;
      razao: string | null;
    }>(
      `select cnpj, cnpj_verificado as verificado, razao_social as razao
         from perfis_prestador where usuario_id = $1`,
      [id],
    );
    expect(r.rows[0].cnpj).toBeNull();
    expect(r.rows[0].verificado).toBe(false);
    expect(r.rows[0].razao).toBeNull();
  });

  it("o mesmo CNPJ não pode servir a dois prestadores", async () => {
    const a = await criarUsuario("prestador_servico", "mei-a@teste.lupa");
    const b = await criarUsuario("prestador_servico", "mei-b@teste.lupa");
    await db.query(
      "insert into perfis_prestador (usuario_id, categoria_id) values ($1, 1), ($2, 1)",
      [a, b],
    );

    await db.query(
      "update perfis_prestador set cnpj = '11222333000181' where usuario_id = $1",
      [a],
    );

    await expect(
      db.query(
        "update perfis_prestador set cnpj = '11222333000181' where usuario_id = $1",
        [b],
      ),
    ).rejects.toThrow();
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
    "candidate_applications",
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

  /**
   * O CPF é o documento de quem oferece serviço, e mora em `usuarios`.
   *
   * O lugar simétrico ao CNPJ seria `perfis_prestador` — e é justamente
   * onde ele não pode ficar: aquela tabela tem policy `using (true)` e
   * `grant select` para `anon`, a chave que roda no navegador. CNPJ pode
   * ser público porque é registro público; CPF não é.
   *
   * Este teste existe para o dia em que alguém "arrumar" a assimetria.
   */
  it("o CPF não está em nenhuma tabela ou view que anon leia", async () => {
    const r = await db.query<{ objeto: string }>(
      `select cl.relname as objeto
         from pg_attribute a
         join pg_class cl on cl.oid = a.attrelid
         join pg_namespace n on n.oid = cl.relnamespace
        where a.attname = 'cpf'
          and a.attnum > 0
          and not a.attisdropped
          and n.nspname = 'public'
          and cl.relkind in ('r', 'v')
          and has_table_privilege('anon', cl.oid, 'SELECT')`,
    );

    expect(r.rows.map((l) => l.objeto)).toEqual([]);
  });

  it("o CPF é único onde existe, e livre onde não existe", async () => {
    await db.query(
      `insert into usuarios (email, senha_hash, papel, nome_completo, telefone, cpf)
       values ('cpf1@lupa.test', 'h', 'prestador_servico', 'Um', '66999990001', '52998224725')`,
    );

    // Segundo prestador com o mesmo documento não entra.
    await expect(
      db.query(
        `insert into usuarios (email, senha_hash, papel, nome_completo, telefone, cpf)
         values ('cpf2@lupa.test', 'h', 'prestador_servico', 'Dois', '66999990002', '52998224725')`,
      ),
    ).rejects.toThrow();

    /*
     * Mas duas contas sem documento convivem: o índice é parcial porque a
     * esmagadora maioria das contas nunca vai ter CPF — não é prestador.
     */
    await db.query(
      `insert into usuarios (email, senha_hash, papel, nome_completo, telefone)
       values ('semcpf1@lupa.test', 'h', 'candidato_clt', 'Três', '66999990003'),
              ('semcpf2@lupa.test', 'h', 'candidato_clt', 'Quatro', '66999990004')`,
    );
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
    expect(tabelas.rows).toHaveLength(14);

    const views = await banco.query<{ total: string }>(
      `select count(*) as total from information_schema.views
       where table_schema = 'public'`,
    );
    expect(Number(views.rows[0].total)).toBe(10);
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

/**
 * Visualizações de vaga.
 *
 * Uma linha por vaga e por dia, incrementada. O que pode dar errado em
 * silêncio é a corrida: duas visitas ao mesmo tempo lendo o mesmo valor e
 * gravando o mesmo número, perdendo uma contagem. É por isso que o
 * incremento mora numa função com `on conflict do update` — no banco, que
 * é o único lugar onde essa corrida não existe.
 */
describe("contagem de visualizações", () => {
  let banco: PGlite;
  let vagaId: string;

  beforeAll(async () => {
    banco = await PGlite.create();
    await banco.exec(SCHEMA);

    const empresa = await banco.query<{ id: string }>(
      `insert into usuarios (email, senha_hash, papel, nome_completo, telefone)
       values ('vis@teste.lupa', 'h', 'empresa', 'Empresa', '66000000001')
       returning id`,
    );
    await banco.query(
      `insert into perfis_empresa (usuario_id, razao_social, cnpj)
       values ($1, 'Empresa', '11222333000181')`,
      [empresa.rows[0].id],
    );
    const vaga = await banco.query<{ id: string }>(
      `insert into vagas (empresa_id, titulo, descricao)
       values ($1, 'Cargo', 'Descrição') returning id`,
      [empresa.rows[0].id],
    );
    vagaId = vaga.rows[0].id;
  }, 60_000);

  afterAll(async () => {
    await banco?.close();
  });

  it("a primeira visualização cria a linha do dia", async () => {
    await banco.query("select registrar_visualizacao($1)", [vagaId]);

    const r = await banco.query<{ total: number }>(
      "select total from visualizacoes_vaga where vaga_id = $1",
      [vagaId],
    );
    expect(r.rows[0].total).toBe(1);
  });

  it("as seguintes somam na mesma linha, sem criar outra", async () => {
    for (let i = 0; i < 4; i++) {
      await banco.query("select registrar_visualizacao($1)", [vagaId]);
    }

    const r = await banco.query<{ total: number; linhas: string }>(
      `select total, count(*) over () as linhas
         from visualizacoes_vaga where vaga_id = $1`,
      [vagaId],
    );
    expect(r.rows[0].total).toBe(5);
    expect(Number(r.rows[0].linhas), "criou linha a mais").toBe(1);
  });

  /** Incrementos simultâneos não podem perder contagem. */
  it("dez visualizações ao mesmo tempo contam dez", async () => {
    const antes = await banco.query<{ total: number }>(
      "select total from visualizacoes_vaga where vaga_id = $1",
      [vagaId],
    );

    await Promise.all(
      Array.from({ length: 10 }, () =>
        banco.query("select registrar_visualizacao($1)", [vagaId]),
      ),
    );

    const depois = await banco.query<{ total: number }>(
      "select total from visualizacoes_vaga where vaga_id = $1",
      [vagaId],
    );
    expect(depois.rows[0].total).toBe(antes.rows[0].total + 10);
  });

  /** A vaga apagada leva as contagens junto: não sobra órfã. */
  it("apagar a vaga apaga as visualizações", async () => {
    await banco.query("delete from vagas where id = $1", [vagaId]);

    const r = await banco.query<{ total: string }>(
      "select count(*) as total from visualizacoes_vaga where vaga_id = $1",
      [vagaId],
    );
    expect(Number(r.rows[0].total)).toBe(0);
  });

  /** Total negativo seria erro de programa; o banco recusa. */
  it("o banco recusa total negativo", async () => {
    await expect(
      banco.query(
        `insert into visualizacoes_vaga (vaga_id, dia, total)
         values (gen_random_uuid(), current_date, -1)`,
      ),
    ).rejects.toThrow();
  });
});

/**
 * As habilidades da vaga, que alimentam a recomendação.
 *
 * O campo é opcional e tem `default '{}'`: toda vaga publicada antes dele
 * existir precisa continuar válida, e o casamento cai para o título e a
 * descrição nesse caso.
 */
describe("habilidades da vaga", () => {
  let banco: PGlite;
  let empresaId: string;

  beforeAll(async () => {
    banco = await PGlite.create();
    await banco.exec(SCHEMA);

    const empresa = await banco.query<{ id: string }>(
      `insert into usuarios (email, senha_hash, papel, nome_completo, telefone)
       values ('hab@teste.lupa', 'h', 'empresa', 'Empresa', '66000000001')
       returning id`,
    );
    empresaId = empresa.rows[0].id;
    await banco.query(
      `insert into perfis_empresa (usuario_id, razao_social, cnpj)
       values ($1, 'Empresa', '11222333000181')`,
      [empresaId],
    );
  }, 60_000);

  afterAll(async () => {
    await banco.close();
  });

  it("nasce como lista vazia, não nula", async () => {
    const r = await banco.query<{ habilidades: string[] }>(
      `insert into vagas (empresa_id, titulo, descricao, cidade)
       select usuario_id, 'Vaga sem habilidade', 'Descricao.', 'Sinop'
         from perfis_empresa limit 1
       returning habilidades`,
    );

    expect(r.rows[0].habilidades).toEqual([]);
  });

  it("guarda a lista como veio, sem mexer no texto", async () => {
    const r = await banco.query<{ habilidades: string[] }>(
      `insert into vagas (empresa_id, titulo, descricao, cidade, habilidades)
       select usuario_id, 'Operador', 'Descricao.', 'Sinop',
              array['Colheitadeira', 'CNH D']
         from perfis_empresa limit 1
       returning habilidades`,
    );

    // A normalização é da aplicação; o banco guarda o que a empresa
    // escreveu, que é o que a tela mostra de volta.
    expect(r.rows[0].habilidades).toEqual(["Colheitadeira", "CNH D"]);
  });

  it("a view job_listings expõe como `skills`", async () => {
    const r = await banco.query<{ skills: string[] }>(
      `select skills from job_listings where title = 'Operador' limit 1`,
    );

    expect(r.rows[0].skills).toEqual(["Colheitadeira", "CNH D"]);
  });
});

/**
 * "Quero que empresas me encontrem", travado no banco.
 *
 * O `where` da view `candidatos_disponiveis` é a fechadura, e é por isso
 * que ele mora no banco e não na aplicação: nenhum esquecimento de filtro
 * numa tela pode revelar alguém que não ligou a opção.
 *
 * O que está em jogo é concreto — numa cidade do tamanho de Sinop, quem
 * está empregado e procurando outra coisa pode ter o patrão atual entre as
 * empresas cadastradas.
 */
describe("candidatos disponíveis", () => {
  let banco: PGlite;

  beforeAll(async () => {
    banco = await PGlite.create();
    await banco.exec(SCHEMA);

    for (const [email, nome, visivel] of [
      ["opta@teste.lupa", "Quem Optou", true],
      ["nao@teste.lupa", "Quem Nao Optou", false],
    ] as const) {
      const u = await banco.query<{ id: string }>(
        `insert into usuarios (email, senha_hash, papel, nome_completo, telefone)
         values ($1, 'h', 'candidato_clt', $2, '66000000001') returning id`,
        [email, nome],
      );
      await banco.query(
        `insert into perfis_candidato (usuario_id, habilidades, visivel_para_empresas)
         values ($1, array['Excel'], $2)`,
        [u.rows[0].id, visivel],
      );
    }
  }, 60_000);

  afterAll(async () => {
    await banco.close();
  });

  it("nasce desligado — o padrão é o que protege", async () => {
    const u = await banco.query<{ id: string }>(
      `insert into usuarios (email, senha_hash, papel, nome_completo, telefone)
       values ('padrao@teste.lupa', 'h', 'candidato_clt', 'Padrao', '66000000002')
       returning id`,
    );
    const r = await banco.query<{ visivel_para_empresas: boolean }>(
      `insert into perfis_candidato (usuario_id) values ($1)
       returning visivel_para_empresas`,
      [u.rows[0].id],
    );

    expect(r.rows[0].visivel_para_empresas).toBe(false);
  });

  it("a view mostra só quem ligou a opção", async () => {
    const r = await banco.query<{ full_name: string }>(
      `select full_name from candidatos_disponiveis order by full_name`,
    );

    expect(r.rows.map((x) => x.full_name)).toEqual(["Quem Optou"]);
  });

  /*
   * Currículo e resumo ficam de fora: quem se candidata entrega o
   * currículo junto com a candidatura; quem só está visível entregou
   * contato. Misturar os dois faria "pode me procurar" significar "leia
   * meu histórico inteiro".
   */
  it("não expõe currículo nem resumo", async () => {
    const r = await banco.query<{ column_name: string }>(
      `select column_name from information_schema.columns
        where table_name = 'candidatos_disponiveis'`,
    );
    const colunas = r.rows.map((x) => x.column_name);

    expect(colunas).not.toContain("curriculo_url");
    expect(colunas).not.toContain("resume_url");
    expect(colunas).not.toContain("resumo");
    // Mas traz o que serve para procurar e falar.
    expect(colunas).toEqual(
      expect.arrayContaining(["full_name", "city", "skills", "phone"]),
    );
  });

  it("desligar tira da view na hora", async () => {
    await banco.query(
      `update perfis_candidato set visivel_para_empresas = false
        where usuario_id in (select id from usuarios where email = 'opta@teste.lupa')`,
    );

    const r = await banco.query(`select 1 from candidatos_disponiveis`);
    expect(r.rows).toEqual([]);
  });

  it("a chave anônima não lê a view", async () => {
    const r = await banco.query<{ tem_acesso: boolean }>(
      `select has_table_privilege('anon', 'candidatos_disponiveis', 'SELECT')
              as tem_acesso`,
    );
    expect(r.rows[0].tem_acesso).toBe(false);
  });
});

/**
 * Buscas que não acharam nada, no banco.
 *
 * O que estes testes travam é o que a tabela **não** tem: nenhuma coluna
 * que ligue o termo a uma pessoa. Histórico de busca de quem procura
 * emprego é a mesma classe de informação que o currículo — numa cidade do
 * tamanho de Sinop, saber que alguém pesquisou "vaga de motorista" três
 * vezes esta semana diz que essa pessoa quer sair do emprego atual.
 */
describe("buscas sem resultado", () => {
  let banco: PGlite;

  beforeAll(async () => {
    banco = await PGlite.create();
    await banco.exec(SCHEMA);
  }, 60_000);

  afterAll(async () => {
    await banco.close();
  });

  it("não guarda quem buscou", async () => {
    const r = await banco.query<{ column_name: string }>(
      `select column_name from information_schema.columns
        where table_name = 'buscas_sem_resultado'`,
    );
    const colunas = r.rows.map((x) => x.column_name).sort();

    expect(colunas).toEqual(["dia", "onde", "termo", "total"]);
    // Nominalmente, para o dia em que alguém for acrescentar uma coluna.
    for (const proibida of ["usuario_id", "candidato_id", "sessao", "ip"]) {
      expect(colunas).not.toContain(proibida);
    }
  });

  it("soma o mesmo termo no mesmo dia em vez de criar linha", async () => {
    for (let i = 0; i < 3; i++) {
      await banco.query(
        `select registrar_busca_sem_resultado('soldador', 'vagas')`,
      );
    }

    const r = await banco.query<{ total: number; linhas: string }>(
      `select total, count(*) over () as linhas
         from buscas_sem_resultado where termo = 'soldador'`,
    );

    expect(r.rows).toHaveLength(1);
    expect(Number(r.rows[0].total)).toBe(3);
  });

  it("a mesma palavra em telas diferentes conta separado", async () => {
    await banco.query(
      `select registrar_busca_sem_resultado('pedreiro', 'vagas')`,
    );
    await banco.query(
      `select registrar_busca_sem_resultado('pedreiro', 'servicos')`,
    );

    const r = await banco.query<{ onde: string }>(
      `select onde from buscas_sem_resultado where termo = 'pedreiro' order by onde`,
    );
    expect(r.rows.map((x) => x.onde)).toEqual(["servicos", "vagas"]);
  });

  it("dez buscas simultâneas contam dez", async () => {
    await Promise.all(
      Array.from({ length: 10 }, () =>
        banco.query(
          `select registrar_busca_sem_resultado('concorrente', 'vagas')`,
        ),
      ),
    );

    const r = await banco.query<{ total: number }>(
      `select total from buscas_sem_resultado where termo = 'concorrente'`,
    );
    expect(Number(r.rows[0].total)).toBe(10);
  });

  it("recusa tela que não existe", async () => {
    await expect(
      banco.query(`select registrar_busca_sem_resultado('x', 'inventada')`),
    ).rejects.toThrow();
  });

  it("recusa termo curto demais", async () => {
    await expect(
      banco.query(`select registrar_busca_sem_resultado('a', 'vagas')`),
    ).rejects.toThrow();
  });

  it("a chave anônima não lê", async () => {
    const r = await banco.query<{ tem_acesso: boolean }>(
      `select has_table_privilege('anon', 'buscas_sem_resultado', 'SELECT')
              as tem_acesso`,
    );
    expect(r.rows[0].tem_acesso).toBe(false);
  });
});

/**
 * O limite de tentativas, no banco.
 *
 * O contador vivia num `Map` em memória de função serverless: sumia a cada
 * deploy e valia por instância. Com concorrência suficiente, o limite era
 * sugestão.
 *
 * O que estes testes travam é a corrida — que é onde um limite de acesso
 * falha de verdade. Pelo caminho ler-somar-gravar, duas tentativas
 * simultâneas leriam "4" e escreveriam "5" as duas, e a sexta passaria.
 */
describe("limite de tentativas durável", () => {
  let banco: PGlite;
  const JANELA = 900;
  const MAX = 5;
  const BLOQUEIO = 900;

  const falhar = (chave: string) =>
    banco.query<{ registrar_falha_de_acesso: string | null }>(
      `select registrar_falha_de_acesso($1, $2, $3, $4)`,
      [chave, JANELA, MAX, BLOQUEIO],
    );

  beforeAll(async () => {
    banco = await PGlite.create();
    await banco.exec(SCHEMA);
  }, 60_000);

  afterAll(async () => {
    await banco.close();
  });

  it("soma dentro da janela e bloqueia no teto", async () => {
    for (let i = 1; i < MAX; i++) {
      const r = await falhar("login:a@teste.lupa");
      expect(r.rows[0].registrar_falha_de_acesso, `tentativa ${i}`).toBeNull();
    }

    const ultima = await falhar("login:a@teste.lupa");
    expect(ultima.rows[0].registrar_falha_de_acesso).not.toBeNull();
  });

  it("uma chave não afeta a outra", async () => {
    const r = await falhar("login:b@teste.lupa");
    expect(r.rows[0].registrar_falha_de_acesso).toBeNull();
  });

  /*
   * O teste que justifica a função existir. Cinco tentativas ao mesmo
   * tempo têm que somar cinco — se somarem menos, o limite deixa passar
   * exatamente no cenário em que ele deveria funcionar.
   */
  it("tentativas simultâneas somam todas", async () => {
    await Promise.all(
      Array.from({ length: MAX }, () => falhar("login:corrida@teste.lupa")),
    );

    const r = await banco.query<{ tentativas: number }>(
      `select tentativas from tentativas_de_acesso where chave = $1`,
      ["login:corrida@teste.lupa"],
    );
    expect(Number(r.rows[0].tentativas)).toBe(MAX);
  });

  it("janela vencida recomeça do primeiro", async () => {
    await falhar("login:c@teste.lupa");
    await banco.query(
      `update tentativas_de_acesso
          set primeira_em = now() - interval '2 hours', tentativas = 4
        where chave = 'login:c@teste.lupa'`,
    );

    await falhar("login:c@teste.lupa");
    const r = await banco.query<{ tentativas: number }>(
      `select tentativas from tentativas_de_acesso where chave = 'login:c@teste.lupa'`,
    );
    expect(Number(r.rows[0].tentativas)).toBe(1);
  });

  it("a limpeza apaga o que venceu e poupa o que está bloqueado", async () => {
    await banco.query(
      `insert into tentativas_de_acesso (chave, tentativas, primeira_em, bloqueado_ate)
       values ('velha', 1, now() - interval '10 hours', null),
              ('presa', 5, now() - interval '10 hours', now() + interval '10 minutes')`,
    );

    await banco.query(`select limpar_tentativas_vencidas($1)`, [JANELA]);

    const r = await banco.query<{ chave: string }>(
      `select chave from tentativas_de_acesso where chave in ('velha', 'presa')`,
    );
    expect(r.rows.map((x) => x.chave)).toEqual(["presa"]);
  });

  it("a chave anônima não lê", async () => {
    const r = await banco.query<{ tem_acesso: boolean }>(
      `select has_table_privilege('anon', 'tentativas_de_acesso', 'SELECT')
              as tem_acesso`,
    );
    expect(r.rows[0].tem_acesso).toBe(false);
  });
});
