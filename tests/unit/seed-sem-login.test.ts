/**
 * @vitest-environment node
 *
 * As contas de `supabase/seed.sql` são de vitrine: existem para a plataforma
 * não abrir vazia. Nenhuma delas pode aceitar login.
 *
 * Existe porque a documentação afirmou por um tempo que a senha de todas era
 * `lupa1234` — e não era. O hash do seed nunca correspondeu a senha alguma.
 * Quem seguia o passo a passo tentava entrar, falhava, e ia depurar uma
 * autenticação que estava funcionando.
 *
 * O teste trava o comportamento nos dois sentidos. Se alguém trocar o hash
 * fabricado por um Argon2id de verdade, catorze contas — três delas empresas
 * que publicam vaga — passam a ser acessíveis por uma senha versionada no
 * repositório. Perfil de exemplo precisa ser visto, não acessado.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { verify } from "@node-rs/argon2";
import { describe, expect, it } from "vitest";

const SEED = readFileSync(join(process.cwd(), "supabase/seed.sql"), "utf8");

/** Todo hash Argon2id que aparece no seed, sem repetição. */
const HASHES = [...new Set(SEED.match(/\$argon2id\$[^']+/g) ?? [])];

/**
 * Senhas que alguém tentaria: a que a documentação já prometeu, variações
 * óbvias e as campeãs de lista de senha vazada.
 */
const TENTATIVAS = [
  "lupa1234",
  "Lupa1234",
  "lupa123",
  "LUPA1234",
  "senha123",
  "123456",
  "12345678",
  "password",
  "admin",
  "teste",
  "",
];

describe("as contas do seed não aceitam login", () => {
  it("o seed traz pelo menos um hash — senão o teste não prova nada", () => {
    expect(HASHES.length).toBeGreaterThan(0);
  });

  it.each(HASHES)("nenhuma senha comum abre %s", async (hash) => {
    for (const senha of TENTATIVAS) {
      let aceitou: boolean;
      try {
        aceitou = await verify(hash, senha);
      } catch {
        // Hash que o Argon2 nem consegue interpretar também não loga.
        aceitou = false;
      }
      expect(aceitou, `a senha "${senha}" abriu uma conta do seed`).toBe(false);
    }
  });

  /**
   * O jeito silencioso de quebrar isto é gerar um hash de verdade e não
   * perceber que ele passou a valer. Todas as contas compartilham o mesmo
   * hash fixo justamente para não parecerem credenciais reais.
   */
  it("todas as contas compartilham o mesmo hash de vitrine", () => {
    expect(HASHES).toHaveLength(1);
  });

  it("a documentação do seed não promete senha nenhuma", () => {
    expect(SEED).not.toMatch(/senha de todas as contas:\s*\S/i);
    expect(SEED.toLowerCase()).toContain("nenhuma senha abre");
  });
});
