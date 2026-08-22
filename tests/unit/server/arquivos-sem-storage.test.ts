/**
 * @vitest-environment node
 *
 * O modo demonstração roda com repositório em memória, e não existe
 * equivalente em memória para arquivo. Aceitar o envio e perder o arquivo
 * faria a pessoa achar que salvou — o pior resultado possível.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/service", () => ({
  temChaveDeServico: false,
  clienteDeServico: () => null,
}));

const { enviarArquivo, removerArquivo, temArmazenamento, urlAssinada } =
  await import("@/server/arquivos/servico");
const { ehAppError } = await import("@/server/errors");

const ID = "11111111-1111-4111-8111-000000000001";
const FOTO = new File([new Uint8Array(10)], "f.jpg", { type: "image/jpeg" });

describe("sem Supabase configurado", () => {
  it("o app sabe que não há armazenamento", () => {
    expect(temArmazenamento).toBe(false);
  });

  it("enviar recusa explicando, em vez de fingir que guardou", async () => {
    await expect(enviarArquivo(ID, "avatar", FOTO)).rejects.toSatisfy(
      (e) => ehAppError(e) && e.codigo === "indisponivel",
    );
  });

  /** Remover não tem o que remover: sair calado aqui é o certo. */
  it("remover não quebra", async () => {
    await expect(removerArquivo(ID, "avatar")).resolves.toBeUndefined();
  });

  it("não há link para currículo nenhum", async () => {
    expect(await urlAssinada("curriculo/x.pdf")).toBeNull();
  });
});
