/**
 * @vitest-environment node
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Autenticado } from "@/server/auth/rbac";
import { ehAppError } from "@/server/errors";
import {
  RepositorioPublicacoesMemoria,
  usarRepositorioPublicacoes,
} from "@/server/publicacoes";
import {
  arquivarPublicacao,
  criarPublicacao,
  editarPublicacao,
  listarPublicacoes,
  reativarPublicacao,
  resumo,
} from "@/server/publicacoes/servico";
import { LIMITE_PUBLICACOES_ATIVAS } from "@/server/publicacoes/tipos";

const prestador: Autenticado = {
  usuarioId: "prestador-1",
  papel: "prestador_servico",
};
const empresa: Autenticado = { usuarioId: "empresa-1", papel: "empresa" };
const candidato: Autenticado = {
  usuarioId: "candidato-1",
  papel: "candidato_clt",
};

const CONTEUDO = {
  titulo: "Instalação elétrica concluída",
  corpo: "Quadro novo instalado no Jardim Botânico, com disjuntores DR.",
};

describe("publicações de perfil", () => {
  let repo: RepositorioPublicacoesMemoria;
  let restaurar: () => void;

  beforeEach(() => {
    repo = new RepositorioPublicacoesMemoria();
    restaurar = usarRepositorioPublicacoes(repo);
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    restaurar();
    vi.restoreAllMocks();
  });

  describe("permissões", () => {
    /**
     * O feed é de quem vende o próprio trabalho.
     *
     * Decisão do Luiz em 03/09/2026. Quem faz obra, faxina ou instalação
     * sem ter aberto CNPJ está cadastrado como candidato — o papel mais
     * numeroso do app —, e a foto do serviço já feito é o que convence
     * quem contrata.
     */
    it("prestador e candidato publicam", async () => {
      await expect(criarPublicacao(prestador, CONTEUDO)).resolves.toBeTruthy();
      await expect(criarPublicacao(candidato, CONTEUDO)).resolves.toBeTruthy();
    });

    /**
     * A empresa tinha a capacidade e nenhuma tela que a usasse. Quem
     * representa a empresa na busca é a logo e o cartão dela, que têm
     * campo próprio; o que ela publica são vagas.
     */
    it("empresa não publica no feed", async () => {
      const erro = await capturar(() => criarPublicacao(empresa, CONTEUDO));
      expect(erro.codigo).toBe("sem_permissao");
    });

    it("sem sessão é 401, não 403", async () => {
      const erro = await capturar(() => criarPublicacao(null, CONTEUDO));
      expect(erro.codigo).toBe("nao_autenticado");
    });

    /**
     * Capacidade responde "pode editar publicação"; não responde "pode
     * editar *esta*". Sem a checagem de dono, qualquer prestador alcança a
     * publicação de outro trocando o id.
     */
    it("ninguém edita a publicação de outro", async () => {
      const dele = await criarPublicacao(prestador, CONTEUDO);

      const outro: Autenticado = {
        usuarioId: "prestador-2",
        papel: "prestador_servico",
      };
      const erro = await capturar(() =>
        editarPublicacao(outro, dele.id, { titulo: "Invadido" }),
      );

      // 404, não 403: um 403 confirmaria que a publicação existe.
      expect(erro.codigo).toBe("nao_encontrado");
    });

    it("ninguém arquiva a publicação de outro", async () => {
      const dele = await criarPublicacao(prestador, CONTEUDO);
      const outro: Autenticado = { usuarioId: "x", papel: "candidato_clt" };

      const erro = await capturar(() => arquivarPublicacao(outro, dele.id));
      expect(erro.codigo).toBe("nao_encontrado");
    });
  });

  describe("limite de ativas", () => {
    async function encher(quantas: number) {
      for (let i = 0; i < quantas; i++) {
        await criarPublicacao(prestador, {
          ...CONTEUDO,
          titulo: `${CONTEUDO.titulo} ${i}`,
        });
      }
    }

    it(`permite exatamente ${LIMITE_PUBLICACOES_ATIVAS}`, async () => {
      await encher(LIMITE_PUBLICACOES_ATIVAS);
      expect(await repo.contarAtivas(prestador.usuarioId)).toBe(
        LIMITE_PUBLICACOES_ATIVAS,
      );
    });

    it("a de número onze é recusada", async () => {
      await encher(LIMITE_PUBLICACOES_ATIVAS);

      const erro = await capturar(() => criarPublicacao(prestador, CONTEUDO));
      expect(erro.codigo).toBe("limite_excedido");
    });

    /** "Limite atingido" sozinho deixa a pessoa sem saída aparente. */
    it("a mensagem diz o que fazer e garante que nada é apagado", async () => {
      await encher(LIMITE_PUBLICACOES_ATIVAS);
      const erro = await capturar(() => criarPublicacao(prestador, CONTEUDO));

      expect(erro.mensagem).toContain("Arquive");
      expect(erro.mensagem).toContain("nada é apagado");
    });

    it("arquivar abre espaço", async () => {
      await encher(LIMITE_PUBLICACOES_ATIVAS);
      const [primeira] = await listarPublicacoes(prestador.usuarioId);

      await arquivarPublicacao(prestador, primeira.id);

      await expect(criarPublicacao(prestador, CONTEUDO)).resolves.toBeTruthy();
    });

    /** Arquivar não pode virar um jeito de manter vinte e alternar quais aparecem. */
    it("reativar também passa pelo limite", async () => {
      await encher(LIMITE_PUBLICACOES_ATIVAS);
      const [primeira] = await listarPublicacoes(prestador.usuarioId);

      await arquivarPublicacao(prestador, primeira.id);
      await criarPublicacao(prestador, CONTEUDO);

      const erro = await capturar(() =>
        reativarPublicacao(prestador, primeira.id),
      );
      expect(erro.codigo).toBe("limite_excedido");
    });

    it("o limite é por perfil, não global", async () => {
      await encher(LIMITE_PUBLICACOES_ATIVAS);
      await expect(criarPublicacao(candidato, CONTEUDO)).resolves.toBeTruthy();
    });

    it("arquivada não conta, mas continua acessível ao autor", async () => {
      const p = await criarPublicacao(prestador, CONTEUDO);
      await arquivarPublicacao(prestador, p.id);

      expect(await repo.contarAtivas(prestador.usuarioId)).toBe(0);
      expect(await listarPublicacoes(prestador.usuarioId)).toHaveLength(1);
      expect(
        await listarPublicacoes(prestador.usuarioId, "arquivada"),
      ).toHaveLength(1);
    });

    it("resumo informa quantas ainda cabem", async () => {
      await encher(3);
      expect(await resumo(prestador.usuarioId)).toEqual({
        ativas: 3,
        limite: LIMITE_PUBLICACOES_ATIVAS,
        restantes: LIMITE_PUBLICACOES_ATIVAS - 3,
      });
    });
  });

  describe("edição", () => {
    it("o autor edita a própria", async () => {
      const p = await criarPublicacao(prestador, CONTEUDO);
      const editada = await editarPublicacao(prestador, p.id, {
        titulo: "Título novo",
      });

      expect(editada.titulo).toBe("Título novo");
      expect(editada.corpo).toBe(CONTEUDO.corpo);
    });

    it("editar registra a data de atualização", async () => {
      const p = await criarPublicacao(prestador, CONTEUDO);
      await new Promise((r) => setTimeout(r, 5));
      const editada = await editarPublicacao(prestador, p.id, {
        corpo: "Texto novo com tamanho suficiente.",
      });

      expect(+new Date(editada.atualizadoEm)).toBeGreaterThan(
        +new Date(p.criadoEm),
      );
    });

    it("id inexistente é 'não encontrado'", async () => {
      const erro = await capturar(() =>
        editarPublicacao(prestador, "nao-existe", { titulo: "x" }),
      );
      expect(erro.codigo).toBe("nao_encontrado");
    });
  });

  describe("listagem", () => {
    it("mais recente primeiro", async () => {
      await criarPublicacao(prestador, {
        ...CONTEUDO,
        titulo: "Primeira aqui",
      });
      await new Promise((r) => setTimeout(r, 5));
      await criarPublicacao(prestador, { ...CONTEUDO, titulo: "Segunda aqui" });

      const lista = await listarPublicacoes(prestador.usuarioId);
      expect(lista[0].titulo).toBe("Segunda aqui");
    });

    it("não mistura autores", async () => {
      await criarPublicacao(prestador, CONTEUDO);
      await criarPublicacao(candidato, CONTEUDO);

      expect(await listarPublicacoes(prestador.usuarioId)).toHaveLength(1);
      expect(await listarPublicacoes(candidato.usuarioId)).toHaveLength(1);
    });
  });
});

async function capturar(fn: () => Promise<unknown>) {
  try {
    await fn();
    throw new Error("esperava um erro, mas passou");
  } catch (e) {
    if (!ehAppError(e)) throw e;
    return e;
  }
}
