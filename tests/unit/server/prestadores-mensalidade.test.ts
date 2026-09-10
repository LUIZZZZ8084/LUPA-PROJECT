/**
 * @vitest-environment node
 *
 * Mensalidade de prestador: `estenderMensalidade` e os dois números de
 * dias que ela recebe — 30 (parcela normal) e `DIAS_TESTE_GRATIS` (início
 * do teste, na confirmação da assinatura em
 * `pagamentos/servico.ts`).
 *
 * Desde a #170, virar prestador não dá mais carência sem cartão: o teste
 * grátis só começa quando o Mercado Pago confirma que o cartão foi
 * autorizado, e esse caminho tem teste próprio em
 * `pagamentos-renovacao.test.ts`. Aqui o que se prova é a aritmética da
 * extensão em si, isolada de quem a aciona.
 *
 * As datas são conferidas com margem, não com igualdade exata: entre a
 * conta rodar e o teste ler o resultado passam alguns milissegundos, e
 * comparar por igualdade estrita faria o teste falhar por um motivo que
 * não é o dele.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Autenticado } from "@/server/auth/rbac";
import {
  estenderMensalidade,
  virarPrestador,
} from "@/server/prestadores/servico";
import {
  RepositorioMemoria,
  repositorioUsuarios,
  usarRepositorio,
} from "@/server/repositories";

const CPF_VALIDO = "52998224725";
const UM_DIA_MS = 24 * 60 * 60 * 1000;

function diasAPartirDeAgora(iso: string): number {
  return (new Date(iso).getTime() - Date.now()) / UM_DIA_MS;
}

describe("mensalidade de prestador", () => {
  let repo: RepositorioMemoria;
  let restaurar: () => void;

  async function criarPrestador() {
    const usuario = await repo.criar({
      email: `p${Math.random()}@teste.lupa`,
      senhaHash: "hash",
      papel: "candidato_clt",
      nomeCompleto: "Prestador de Teste",
      telefone: "66999990000",
      cidade: "Sinop",
    });
    const sessao: Autenticado = {
      usuarioId: usuario.id,
      papel: "candidato_clt",
    };
    await virarPrestador(
      sessao,
      { cpf: CPF_VALIDO, categoriaId: 1, descricao: "Instalações elétricas." },
      { temArmazenamento: false },
    );
    return usuario.id;
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

  /**
   * Sem carência (#170): virar prestador não libera a vitrine sozinho —
   * precisa de uma assinatura, que só existe depois de o cartão ser
   * autorizado em `/perfil/assinatura`.
   */
  it("virar prestador não concede mensalidade nenhuma", async () => {
    const id = await criarPrestador();
    const perfil = await repo.perfilPrestador(id);

    expect(perfil?.mensalidadeValidaAte).toBeNull();
  });

  it("estende 30 dias a partir de agora quando a mensalidade já venceu", async () => {
    const id = await criarPrestador();
    await repo.definirMensalidadeValidaAte(
      id,
      new Date(Date.now() - UM_DIA_MS).toISOString(),
    );

    await estenderMensalidade(id);

    const perfil = await repo.perfilPrestador(id);
    const dias = diasAPartirDeAgora(perfil?.mensalidadeValidaAte as string);
    expect(dias).toBeGreaterThan(29);
    expect(dias).toBeLessThan(31);
  });

  it("renovar antes de vencer soma ao prazo que já valia — não perde dias pagos", async () => {
    const id = await criarPrestador();
    await estenderMensalidade(id);

    // ~30 dias já valiam; renovar de novo antes de vencer deve dar ~60.
    await estenderMensalidade(id);

    const perfil = await repo.perfilPrestador(id);
    const dias = diasAPartirDeAgora(perfil?.mensalidadeValidaAte as string);
    expect(dias).toBeGreaterThan(59);
    expect(dias).toBeLessThan(61);
  });

  /**
   * O segundo argumento é o que o início do teste grátis usa — 15 dias,
   * não os 30 de uma parcela normal (#170). A aritmética é a mesma; só o
   * número muda.
   */
  it("aceita um número de dias diferente de 30, para o teste grátis", async () => {
    const id = await criarPrestador();

    await estenderMensalidade(id, 15);

    const perfil = await repo.perfilPrestador(id);
    const dias = diasAPartirDeAgora(perfil?.mensalidadeValidaAte as string);
    expect(dias).toBeGreaterThan(14);
    expect(dias).toBeLessThan(16);
  });

  it("sem mensalidade anterior nenhuma, estende a partir de agora", async () => {
    const usuario = await repo.criar({
      email: "novo@teste.lupa",
      senhaHash: "hash",
      papel: "prestador_servico",
      nomeCompleto: "Prestador Sem Mensalidade Anterior",
      telefone: "66999990000",
      cidade: "Sinop",
    });
    await repositorioUsuarios().criarPerfilPrestador({
      usuarioId: usuario.id,
      categoriaId: 1,
      descricao: "Teste",
      precoInicial: null,
      anosExperiencia: null,
      bairrosAtendidos: [],
      instagram: null,
      facebook: null,
      cnpj: null,
      cnpjVerificado: false,
      razaoSocial: null,
      mensalidadeValidaAte: null,
    });

    await estenderMensalidade(usuario.id);

    const perfil = await repo.perfilPrestador(usuario.id);
    const dias = diasAPartirDeAgora(perfil?.mensalidadeValidaAte as string);
    expect(dias).toBeGreaterThan(29);
    expect(dias).toBeLessThan(31);
  });

  it("recusa estender a mensalidade de quem não tem perfil de prestador", async () => {
    const usuario = await repo.criar({
      email: "candidato@teste.lupa",
      senhaHash: "hash",
      papel: "candidato_clt",
      nomeCompleto: "Só Candidato",
      telefone: "66999990000",
      cidade: "Sinop",
    });

    await expect(estenderMensalidade(usuario.id)).rejects.toMatchObject({
      codigo: "nao_encontrado",
    });
  });
});
