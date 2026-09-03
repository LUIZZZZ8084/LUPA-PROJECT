/**
 * @vitest-environment node
 *
 * Publicar e editar trabalho com foto, num envio só.
 *
 * `publicarTrabalho` e `editarTrabalho` são a porta de entrada da aba
 * Serviços: quem preenche o formulário manda texto e foto juntos, e o
 * serviço decide se sobe o arquivo antes de gravar a publicação. Ficam
 * separados de `publicacoes.test.ts` porque aqui o Storage precisa ser
 * mockado — os outros testes daquele arquivo não tocam nele, e misturar os
 * dois faria a mesma suíte usar dois comportamentos de módulo diferentes.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const armazenamento = vi.hoisted(() => ({
  comStorage: true,
  enviados: [] as { usuarioId: string; especie: string }[],
}));

vi.mock("@/server/arquivos/servico", () => ({
  get temArmazenamento() {
    return armazenamento.comStorage;
  },
  enviarArquivo: async (usuarioId: string, especie: string) => {
    armazenamento.enviados.push({ usuarioId, especie });
    return { referencia: `https://exemplo/${especie}/${usuarioId}-nova.jpg` };
  },
}));

const { editarTrabalho, publicarTrabalho } = await import(
  "@/server/publicacoes/servico"
);
const { RepositorioPublicacoesMemoria, usarRepositorioPublicacoes } =
  await import("@/server/publicacoes");
const { ehAppError } = await import("@/server/errors");

import type { Autenticado } from "@/server/auth/rbac";

const prestador: Autenticado = {
  usuarioId: "prestador-1",
  papel: "prestador_servico",
};
const empresa: Autenticado = { usuarioId: "empresa-1", papel: "empresa" };

const CONTEUDO = {
  titulo: "Quadro trocado",
  corpo: "Troca completa no Jardim Botânico.",
};

const FOTO = new File(["conteúdo"], "foto.jpg", { type: "image/jpeg" });

describe("publicar e editar trabalho com foto", () => {
  let repo: InstanceType<typeof RepositorioPublicacoesMemoria>;
  let restaurar: () => void;

  beforeEach(() => {
    repo = new RepositorioPublicacoesMemoria();
    restaurar = usarRepositorioPublicacoes(repo);
    armazenamento.comStorage = true;
    armazenamento.enviados = [];
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    restaurar();
    vi.restoreAllMocks();
  });

  describe("publicar", () => {
    it("sem foto, publica sem subir nada ao Storage", async () => {
      const p = await publicarTrabalho(prestador, { ...CONTEUDO, foto: null });

      expect(p.imagemUrl).toBeNull();
      expect(armazenamento.enviados).toHaveLength(0);
    });

    it("com foto e Storage disponível, sobe o arquivo e grava a referência", async () => {
      const p = await publicarTrabalho(prestador, { ...CONTEUDO, foto: FOTO });

      expect(p.imagemUrl).toBe(
        `https://exemplo/publicacao/${prestador.usuarioId}-nova.jpg`,
      );
      expect(armazenamento.enviados).toEqual([
        { usuarioId: prestador.usuarioId, especie: "publicacao" },
      ]);
    });

    /**
     * Sem Supabase não há Storage, e a tela já avisa disso. O que se
     * protege aqui é que a publicação não falhe por causa da foto — ela
     * grava sem imagem, e o texto continua valendo.
     */
    it("com foto mas sem Storage, publica sem imagem", async () => {
      armazenamento.comStorage = false;
      const p = await publicarTrabalho(prestador, { ...CONTEUDO, foto: FOTO });

      expect(p.imagemUrl).toBeNull();
      expect(armazenamento.enviados).toHaveLength(0);
    });
  });

  describe("editar", () => {
    async function publicarDoPrestador() {
      return publicarTrabalho(prestador, { ...CONTEUDO, foto: null });
    }

    it("sem foto nova, troca o texto e mantém a imagem que já estava lá", async () => {
      const original = await publicarTrabalho(prestador, {
        ...CONTEUDO,
        foto: FOTO,
      });
      const imagemAntes = original.imagemUrl;
      armazenamento.enviados = [];

      const editado = await editarTrabalho(prestador, original.id, {
        titulo: "Título corrigido",
        corpo: original.corpo,
        foto: null,
      });

      expect(editado.titulo).toBe("Título corrigido");
      expect(editado.imagemUrl).toBe(imagemAntes);
      expect(armazenamento.enviados).toHaveLength(0);
    });

    it("com foto nova, substitui a imagem", async () => {
      const original = await publicarDoPrestador();

      const editado = await editarTrabalho(prestador, original.id, {
        ...CONTEUDO,
        foto: FOTO,
      });

      expect(editado.imagemUrl).toBe(
        `https://exemplo/publicacao/${prestador.usuarioId}-nova.jpg`,
      );
    });

    /**
     * A checagem de dono acontece antes do upload, de propósito: subir a
     * foto de alguém para só então descobrir que a publicação é de outro
     * deixaria lixo no bucket a cada tentativa.
     */
    it("ninguém edita a publicação de outro, e nada sobe ao Storage", async () => {
      const original = await publicarDoPrestador();
      const outro: Autenticado = {
        usuarioId: "prestador-2",
        papel: "prestador_servico",
      };

      const erro = await editarTrabalho(outro, original.id, {
        ...CONTEUDO,
        foto: FOTO,
      }).catch((e) => e);

      expect(ehAppError(erro) && erro.codigo).toBe("nao_encontrado");
      expect(armazenamento.enviados).toHaveLength(0);
    });

    it("publicação inexistente é 404, não 403", async () => {
      const erro = await editarTrabalho(
        prestador,
        "00000000-0000-0000-0000-000000000000",
        {
          ...CONTEUDO,
          foto: null,
        },
      ).catch((e) => e);

      expect(ehAppError(erro) && erro.codigo).toBe("nao_encontrado");
    });

    it("empresa não edita trabalho — ela não publica no feed", async () => {
      const original = await publicarDoPrestador();

      const erro = await editarTrabalho(empresa, original.id, {
        ...CONTEUDO,
        foto: null,
      }).catch((e) => e);

      expect(ehAppError(erro) && erro.codigo).toBe("sem_permissao");
    });
  });
});
