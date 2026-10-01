/**
 * @vitest-environment node
 *
 * O nome na avaliação acompanha o nome da conta (#304).
 *
 * `avaliacoes.nome_avaliador` é uma cópia, gravada no dia da avaliação,
 * porque quem lista é a chave anônima e `usuarios` é fechada para ela. Sem
 * nada que a mantivesse em dia, quem trocava o nome da conta continuava
 * aparecendo com o nome antigo no comentário — e não tinha como corrigir.
 *
 * Roda contra um Postgres de verdade (PGlite), porque a regra é um trigger:
 * testar a função com um duble provaria a função, não que o banco a chama.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const SCHEMA = readFileSync(join(process.cwd(), "supabase/schema.sql"), "utf8");
const MIGRACAO = readFileSync(
  join(process.cwd(), "supabase/aplica-nome-do-avaliador.sql"),
  "utf8",
);

let contador = 0;

async function criarUsuario(db: PGlite, nome: string, papel = "empresa") {
  contador++;
  const r = await db.query<{ id: string }>(
    `insert into usuarios (email, senha_hash, papel, nome_completo, telefone)
     values ($1, $2, $3::papel_usuario, $4, $5) returning id`,
    [
      `conta${contador}@teste.lupa`,
      "$argon2id$v=19$m=19456,t=2,p=1$abc$def",
      papel,
      nome,
      "66999110001",
    ],
  );
  return r.rows[0].id;
}

async function avaliar(
  db: PGlite,
  prestadorId: string,
  avaliadorId: string | null,
  nome: string,
) {
  await db.query(
    `insert into avaliacoes (prestador_id, avaliador_id, nome_avaliador, nota)
     values ($1, $2, $3, 5)`,
    [prestadorId, avaliadorId, nome],
  );
}

async function renomear(db: PGlite, usuarioId: string, nome: string) {
  await db.query("update usuarios set nome_completo = $2 where id = $1", [
    usuarioId,
    nome,
  ]);
}

async function nomesNasAvaliacoes(db: PGlite, avaliadorId: string) {
  const r = await db.query<{ nome_avaliador: string }>(
    "select nome_avaliador from avaliacoes where avaliador_id = $1 order by criado_em, id",
    [avaliadorId],
  );
  return r.rows.map((l) => l.nome_avaliador);
}

describe("trigger do schema.sql", () => {
  let db: PGlite;

  beforeAll(async () => {
    db = await PGlite.create();
    await db.exec(SCHEMA);
  }, 60_000);

  afterAll(async () => {
    await db?.close();
  });

  it("trocar o nome da conta atualiza o nome nas avaliações dela", async () => {
    const prestador = await criarUsuario(
      db,
      "Eletricista",
      "prestador_servico",
    );
    const pessoa = await criarUsuario(db, "Nome Antigo");
    await avaliar(db, prestador, pessoa, "Nome Antigo");

    await renomear(db, pessoa, "Nome Novo");

    expect(await nomesNasAvaliacoes(db, pessoa)).toEqual(["Nome Novo"]);
  });

  it("vale para todas as avaliações da pessoa, em prestadores diferentes", async () => {
    const um = await criarUsuario(db, "Um", "prestador_servico");
    const dois = await criarUsuario(db, "Dois", "prestador_servico");
    const pessoa = await criarUsuario(db, "Antes");
    await avaliar(db, um, pessoa, "Antes");
    await avaliar(db, dois, pessoa, "Antes");

    await renomear(db, pessoa, "Depois");

    expect(await nomesNasAvaliacoes(db, pessoa)).toEqual(["Depois", "Depois"]);
  });

  it("não mexe nas avaliações de outra pessoa", async () => {
    const prestador = await criarUsuario(db, "Prestador", "prestador_servico");
    const quemTroca = await criarUsuario(db, "Quem Troca");
    const outra = await criarUsuario(db, "Outra Pessoa");
    await avaliar(db, prestador, quemTroca, "Quem Troca");
    const outroPrestador = await criarUsuario(db, "Outro", "prestador_servico");
    await avaliar(db, outroPrestador, outra, "Outra Pessoa");

    await renomear(db, quemTroca, "Trocou");

    expect(await nomesNasAvaliacoes(db, outra)).toEqual(["Outra Pessoa"]);
  });

  /**
   * As do seed não têm dono. Mesmo que o nome dela coincida com o de uma
   * conta que troca de nome, a avaliação sem dono segue como está.
   */
  it("não toca em avaliação sem dono, mesmo com o mesmo nome", async () => {
    const prestador = await criarUsuario(db, "Prestador", "prestador_servico");
    await avaliar(db, prestador, null, "Maria Silva");
    const maria = await criarUsuario(db, "Maria Silva");

    await renomear(db, maria, "Maria Souza");

    const r = await db.query<{ nome_avaliador: string }>(
      "select nome_avaliador from avaliacoes where prestador_id = $1 and avaliador_id is null",
      [prestador],
    );
    expect(r.rows.map((l) => l.nome_avaliador)).toEqual(["Maria Silva"]);
  });

  /** O trigger é de `update of nome_completo`: outro campo não o dispara. */
  it("mudar outro campo da conta não reescreve o nome da avaliação", async () => {
    const prestador = await criarUsuario(db, "Prestador", "prestador_servico");
    const pessoa = await criarUsuario(db, "Nome Da Conta");
    await avaliar(db, prestador, pessoa, "Apelido gravado à mão");

    await db.query(
      "update usuarios set telefone = '66999990000' where id = $1",
      [pessoa],
    );

    expect(await nomesNasAvaliacoes(db, pessoa)).toEqual([
      "Apelido gravado à mão",
    ]);
  });

  it("a nota do prestador continua certa depois da troca", async () => {
    const prestador = await criarUsuario(db, "Com Perfil", "prestador_servico");
    await db.query(
      "insert into perfis_prestador (usuario_id, categoria_id) values ($1, 1)",
      [prestador],
    );
    const pessoa = await criarUsuario(db, "Antes");
    await avaliar(db, prestador, pessoa, "Antes");

    await renomear(db, pessoa, "Depois");

    const r = await db.query<{ total_avaliacoes: number }>(
      "select total_avaliacoes from perfis_prestador where usuario_id = $1",
      [prestador],
    );
    expect(r.rows[0].total_avaliacoes).toBe(1);
  });
});

/**
 * O script que roda em produção. O banco real foi criado antes do trigger,
 * então o que se testa é a passagem do estado de antes para o de depois: as
 * avaliações que já ficaram velhas são corrigidas, e o trigger passa a valer.
 */
describe("aplica-nome-do-avaliador.sql", () => {
  let db: PGlite;

  beforeAll(async () => {
    db = await PGlite.create();
    await db.exec(SCHEMA);
    // O banco de produção, como era antes: sem o trigger e sem a função.
    await db.exec(`
      drop trigger usuarios_renomeiam_avaliacoes on usuarios;
      drop function atualizar_nome_nas_avaliacoes();
    `);
  }, 60_000);

  afterAll(async () => {
    await db?.close();
  });

  it("antes do script, trocar o nome deixa a avaliação velha (o defeito)", async () => {
    const prestador = await criarUsuario(db, "Prestador", "prestador_servico");
    const pessoa = await criarUsuario(db, "Antigo");
    await avaliar(db, prestador, pessoa, "Antigo");

    await renomear(db, pessoa, "Novo");

    expect(await nomesNasAvaliacoes(db, pessoa)).toEqual(["Antigo"]);
  });

  it("corrige as avaliações já gravadas com o nome velho", async () => {
    const velha = await db.query<{ avaliador_id: string }>(
      "select avaliador_id from avaliacoes where nome_avaliador = 'Antigo'",
    );
    const pessoa = velha.rows[0].avaliador_id;
    // Uma sem dono, com nome que nenhuma conta tem: não pode mudar.
    const prestador = await criarUsuario(db, "Outro", "prestador_servico");
    await avaliar(db, prestador, null, "Do Seed");

    await db.exec(MIGRACAO);

    expect(await nomesNasAvaliacoes(db, pessoa)).toEqual(["Novo"]);
    const seed = await db.query<{ nome_avaliador: string }>(
      "select nome_avaliador from avaliacoes where avaliador_id is null and nome_avaliador = 'Do Seed'",
    );
    expect(seed.rows).toHaveLength(1);
  });

  it("depois do script, o trigger vale", async () => {
    const prestador = await criarUsuario(
      db,
      "Prestador B",
      "prestador_servico",
    );
    const pessoa = await criarUsuario(db, "Antes B");
    await avaliar(db, prestador, pessoa, "Antes B");

    await renomear(db, pessoa, "Depois B");

    expect(await nomesNasAvaliacoes(db, pessoa)).toEqual(["Depois B"]);
  });

  it("rodar duas vezes não muda nada e não falha", async () => {
    const antes = await db.query(
      "select id, nome_avaliador from avaliacoes order by id",
    );

    await db.exec(MIGRACAO);

    const depois = await db.query(
      "select id, nome_avaliador from avaliacoes order by id",
    );
    expect(depois.rows).toEqual(antes.rows);
  });
});
