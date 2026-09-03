/**
 * @vitest-environment node
 *
 * De onde `next/image` aceita carregar foto.
 *
 * O que se protege aqui é uma conta a pagar. `remotePatterns` diz quais
 * hosts o otimizador de imagem da Vercel pode buscar, e cada busca é uma
 * transformação cobrada. Um curinga como `**.supabase.co` transformaria o
 * otimizador em proxy de imagem para qualquer projeto do Supabase na
 * internet — e a fatura seria nossa.
 *
 * Por isso o host é derivado da variável do próprio projeto, e este teste
 * existe para que a próxima pessoa que "simplificar" isso para um curinga
 * descubra na CI, e não na fatura.
 */
import { describe, expect, it } from "vitest";
import { hostsDeImagemRemota } from "@/lib/imagens";

describe("hosts de imagem remota", () => {
  it("aceita o host do projeto, e só ele", () => {
    expect(hostsDeImagemRemota("https://abcdef.supabase.co")).toEqual([
      { protocol: "https", hostname: "abcdef.supabase.co" },
    ]);
  });

  /** Curinga é o que este teste existe para impedir. */
  it("o host não tem curinga", () => {
    const hosts = hostsDeImagemRemota("https://abcdef.supabase.co");
    expect(hosts.some((h) => h.hostname.includes("*"))).toBe(false);
  });

  /**
   * Sem Supabase não há Storage, e nenhuma foto remota aparece. A lista
   * vazia é o certo — e o build não pode cair por causa dela, porque é
   * assim que o modo demonstração roda em qualquer máquina.
   */
  it("sem Supabase, lista vazia", () => {
    expect(hostsDeImagemRemota(undefined)).toEqual([]);
    expect(hostsDeImagemRemota("")).toEqual([]);
  });

  /** Ambiente com URL torta cai para a demonstração, não derruba o build. */
  it("URL malformada não quebra o build", () => {
    expect(hostsDeImagemRemota("isto-não-é-uma-url")).toEqual([]);
  });
});
