/**
 * @vitest-environment node
 *
 * A gravação da mensagem de suporte no Postgres (#235).
 *
 * O que se mede aqui é o **mapeamento de coluna**, que é onde este projeto
 * já se queimou: `profile_id` numa tabela cuja chave é `usuario_id` derrubou
 * o painel da empresa inteiro com o banco ligado — não quebrou compilação,
 * não apareceu em revisão de leitura, e só deu as caras quando alguém abriu
 * a tela.
 *
 * Aqui seria pior: a mensagem de quem está com problema sumiria em silêncio,
 * e quem escreveu veria "recebemos a sua mensagem".
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

interface Resposta {
  data: unknown;
  error: { message: string } | null;
}

const chamadas: { tabela: string; metodo: string; args: unknown[] }[] = [];
let resposta: Resposta = { data: null, error: null };

function construtor(tabela: string) {
  const builder: Record<string, unknown> = {
    then: (resolver: (v: Resposta) => unknown) =>
      Promise.resolve(resposta).then(resolver),
  };

  for (const metodo of ["insert", "select", "eq", "update"]) {
    builder[metodo] = (...args: unknown[]) => {
      chamadas.push({ tabela, metodo, args });
      return builder;
    };
  }

  return builder;
}

vi.mock("@/lib/supabase/service", () => ({
  temChaveDeServico: true,
  clienteDeServico: () => ({ from: (tabela: string) => construtor(tabela) }),
}));

import { RepositorioSuportePostgres } from "@/server/suporte/postgres";

const MENSAGEM = {
  usuarioId: "11111111-1111-4111-8111-000000000001",
  nome: "Maria Souza",
  email: "maria@exemplo.test",
  assunto: "pagamento" as const,
  mensagem: "Paguei a vaga ontem e o crédito não entrou.",
};

describe("RepositorioSuportePostgres", () => {
  const repo = new RepositorioSuportePostgres();

  beforeEach(() => {
    chamadas.length = 0;
    resposta = { data: null, error: null };
  });

  it("grava na tabela certa, com as colunas do schema", async () => {
    await repo.registrar(MENSAGEM);

    const insert = chamadas.find((c) => c.metodo === "insert");
    expect(insert?.tabela).toBe("mensagens_suporte");
    expect(insert?.args[0]).toEqual({
      usuario_id: MENSAGEM.usuarioId,
      nome: MENSAGEM.nome,
      email: MENSAGEM.email,
      assunto: MENSAGEM.assunto,
      mensagem: MENSAGEM.mensagem,
    });
  });

  /**
   * Quem não consegue entrar é exatamente quem mais precisa do suporte. A
   * coluna é nulável no schema por isso, e o repositório precisa passar o
   * nulo em vez de inventar um id.
   */
  it("aceita mensagem sem sessão", async () => {
    await repo.registrar({ ...MENSAGEM, usuarioId: null });

    const insert = chamadas.find((c) => c.metodo === "insert");
    expect(insert).toBeDefined();
    const gravado = insert?.args[0] as { usuario_id: unknown };
    expect(gravado.usuario_id).toBeNull();
  });

  /**
   * Falha de banco tem que **subir**, ao contrário da falha de envio de
   * e-mail: se a gravação não aconteceu, a mensagem não existe em lugar
   * nenhum, e dizer "recebemos" seria a pior coisa possível para quem está
   * com um problema.
   */
  it("erro de banco vira indisponível, e não passa batido", async () => {
    resposta = { data: null, error: { message: "conexão recusada" } };

    await expect(repo.registrar(MENSAGEM)).rejects.toMatchObject({
      codigo: "indisponivel",
    });
  });
});
