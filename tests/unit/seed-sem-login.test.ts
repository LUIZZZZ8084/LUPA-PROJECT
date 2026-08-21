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

/**
 * As contas do seed aparecem numa plataforma pública, e o botão de contato
 * monta um link `wa.me` a partir do telefone do perfil.
 *
 * Existe porque aconteceu: o seed foi escrito com números fictícios porém
 * plausíveis (66 99911-0001) e foi para produção. Enquanto o app estava em
 * modo demonstração, `resolveContact` redirecionava o contato e ninguém era
 * incomodado. Ligar o Supabase desarmou essa salvaguarda — ela dependia de
 * `isDemoMode` — justamente no momento em que ela passou a importar. Quem
 * tivesse aquele número em Sinop começaria a receber mensagem de estranhos.
 *
 * A correção não é reforçar a salvaguarda: é o dado de exemplo não carregar
 * telefone discável nenhum.
 */
describe("os telefones do seed não alcançam ninguém", () => {
  const TELEFONES = [...new Set(SEED.match(/'\d{10,13}'/g) ?? [])].map((t) =>
    t.replaceAll("'", ""),
  );

  it("o seed traz telefones — senão o teste não prova nada", () => {
    expect(TELEFONES.length).toBeGreaterThan(0);
  });

  /**
   * No plano de numeração brasileiro a parte de assinante nunca começa em 0.
   * Celular é `9XXXXXXXX`; fixo começa entre 2 e 5.
   */
  it.each(TELEFONES)("%s não é discável: assinante começa em 0", (tel) => {
    const assinante = tel.slice(2);
    expect(assinante.startsWith("0"), `${tel} pode ser de alguém`).toBe(true);
  });

  it("nenhum parece celular brasileiro de verdade", () => {
    const plausiveis = TELEFONES.filter((t) => /^\d{2}9\d{8}$/.test(t));
    expect(plausiveis).toEqual([]);
  });

  it("ainda passam na restrição do banco", () => {
    for (const tel of TELEFONES) expect(tel).toMatch(/^[0-9]{10,13}$/);
  });
});
