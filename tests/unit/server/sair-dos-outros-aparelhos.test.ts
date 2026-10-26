/**
 * @vitest-environment node
 *
 * Sair dos outros aparelhos (#402).
 *
 * O corte é o mesmo da troca de senha (#225): toda sessão emitida antes
 * dele cai, e a comparação é estrita, em segundos — a sessão nova que a
 * action emite logo depois, no mesmo segundo, continua valendo. Quem
 * clicou não pode ser deslogado do aparelho onde clicou.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sairDosOutrosAparelhos } from "@/server/auth/servico";
import { ehAppError } from "@/server/errors";
import { RepositorioMemoria, usarRepositorio } from "@/server/repositories";

let repo: RepositorioMemoria;
let restaurar: () => void;

async function conta(email: string) {
  const u = await repo.criar({
    email,
    senhaHash: "h",
    papel: "candidato_clt",
    nomeCompleto: "Alguém",
    telefone: "66999110013",
    cidade: "Sinop - MT",
  });
  return u.id;
}

beforeEach(() => {
  repo = new RepositorioMemoria();
  restaurar = usarRepositorio(repo);
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  restaurar();
  vi.restoreAllMocks();
});

describe("sair dos outros aparelhos", () => {
  it("corta as sessões emitidas antes, e não a emitida agora", async () => {
    const id = await conta("dono@lupa.test");
    const agora = Math.floor(Date.now() / 1000);

    await sairDosOutrosAparelhos(id);

    const corte = (await repo.cortesDeSessao(30)).get(id);
    expect(corte).toBeDefined();
    // A sessão do outro aparelho, de um minuto atrás, cai.
    expect(agora - 60 < (corte as number)).toBe(true);
    // A sessão que a action emite em seguida não cai.
    expect(Math.floor(Date.now() / 1000) < (corte as number)).toBe(false);
  });

  it("não mexe na sessão de outra pessoa", async () => {
    const dono = await conta("dono@lupa.test");
    const outra = await conta("outra@lupa.test");

    await sairDosOutrosAparelhos(dono);

    expect((await repo.cortesDeSessao(30)).has(outra)).toBe(false);
  });

  it("não troca a senha", async () => {
    const id = await conta("dono@lupa.test");
    await sairDosOutrosAparelhos(id);
    expect((await repo.porId(id))?.senhaHash).toBe("h");
  });

  it("sem sessão, recusa", async () => {
    await expect(sairDosOutrosAparelhos(null)).rejects.toSatisfy(
      (e) => ehAppError(e) && e.codigo === "nao_autenticado",
    );
  });
});
