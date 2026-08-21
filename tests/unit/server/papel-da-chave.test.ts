/**
 * @vitest-environment node
 *
 * A chave anônima colada no lugar da de serviço falhava lá no banco, como
 * `new row violates row-level security policy for table "usuarios"`. A
 * mensagem descreve o sintoma e manda quem lê procurar defeito em policies
 * e schema — onde não há nada errado: o RLS negando a chave anônima é o
 * comportamento projetado.
 *
 * Aconteceu ao criar a conta de admin da produção.
 */
import { describe, expect, it } from "vitest";
import {
  erroDeChaveDeServico,
  papelDaChave,
} from "@/lib/supabase/papel-da-chave";

/** Monta um JWT com o `role` pedido. Só o payload importa aqui. */
function jwt(role: string) {
  const b64 = (o: unknown) =>
    Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ role, iss: "supabase" })}.assinatura`;
}

describe("papelDaChave", () => {
  it("lê o papel do payload do JWT", () => {
    expect(papelDaChave(jwt("anon"))).toBe("anon");
    expect(papelDaChave(jwt("service_role"))).toBe("service_role");
  });

  it("entende o formato novo, sem JWT", () => {
    expect(papelDaChave("sb_secret_abc123")).toBe("service_role");
    expect(papelDaChave("sb_publishable_abc123")).toBe("anon");
  });

  it("ignora espaço em volta", () => {
    expect(papelDaChave(`  ${jwt("service_role")}\n`)).toBe("service_role");
  });

  it.each([
    ["vazia", ""],
    ["texto solto", "cole-aqui"],
    ["JWT com payload ilegível", "aaa.$$$.ccc"],
    ["JWT sem role", jwt2()],
  ])("%s vira desconhecido", (_nome, chave) => {
    expect(papelDaChave(chave)).toBe("desconhecido");
  });
});

/** JWT válido cujo payload não tem `role`. */
function jwt2() {
  const b64 = (o: unknown) =>
    Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${b64({ alg: "HS256" })}.${b64({ iss: "supabase" })}.assinatura`;
}

describe("erroDeChaveDeServico", () => {
  it("recusa a chave anônima e diz onde achar a certa", () => {
    const erro = erroDeChaveDeServico(jwt("anon"));
    expect(erro).toContain("chave anônima");
    expect(erro).toContain("Reveal");
  });

  it("aceita a chave de serviço", () => {
    expect(erroDeChaveDeServico(jwt("service_role"))).toBeNull();
  });

  /**
   * Chave de formato futuro que funcione não pode impedir o app de subir.
   * O que se recusa é a certeza de estar errado, não a dúvida.
   */
  it("não bloqueia formato desconhecido", () => {
    expect(erroDeChaveDeServico("formato-que-ainda-nao-existe")).toBeNull();
    expect(erroDeChaveDeServico("")).toBeNull();
  });
});
