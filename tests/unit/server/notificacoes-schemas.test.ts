/**
 * @vitest-environment node
 *
 * A validação da entrada dos avisos (#48).
 *
 * A cidade passa pela lista do IBGE, e não por um `z.string()` qualquer:
 * cidade livre viraria "Sinop", "sinop" e "Sinop-MT" na mesma base, e o
 * casamento com a vaga deixaria de acontecer. A pessoa marcaria a
 * preferência e nunca receberia nada, sem jeito de descobrir por quê.
 */
import { describe, expect, it } from "vitest";
import {
  schemaInscricao,
  schemaPreferencia,
} from "@/server/notificacoes/schemas";
import { validar } from "@/server/validation";

describe("preferência de aviso", () => {
  it("aceita cidade de Mato Grosso com área da lista", () => {
    const r = validar(schemaPreferencia, {
      cidade: "Sinop",
      categoria: "Agronegócio",
    });
    expect(r.ok).toBe(true);
  });

  /** Vazio é "todas as áreas" — o padrão de quem quer tudo na cidade. */
  it("categoria vazia passa, e significa todas", () => {
    const r = validar(schemaPreferencia, { cidade: "Sinop", categoria: "" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.valor.categoria).toBe("");
  });

  it("sem categoria nenhuma também passa", () => {
    expect(validar(schemaPreferencia, { cidade: "Sorriso" }).ok).toBe(true);
  });

  it("cidade de outro estado é recusada", () => {
    const r = validar(schemaPreferencia, {
      cidade: "Curitiba",
      categoria: "",
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.erro.campos?.some((c) => c.campo === "cidade")).toBe(true);
  });

  it("área fora da lista é recusada", () => {
    const r = validar(schemaPreferencia, {
      cidade: "Sinop",
      categoria: "Astronauta",
    });
    expect(r.ok).toBe(false);
  });
});

describe("inscrição do aparelho", () => {
  const valida = {
    endpoint: "https://fcm.googleapis.com/fcm/send/abc123",
    p256dh: "chave-publica-do-aparelho",
    auth: "sal",
  };

  it("aceita o que o navegador devolve", () => {
    expect(validar(schemaInscricao, valida).ok).toBe(true);
  });

  /** Endpoint é URL de verdade; texto solto ali não vira nada útil. */
  it("endpoint que não é URL é recusado", () => {
    const r = validar(schemaInscricao, { ...valida, endpoint: "abc" });
    expect(r.ok).toBe(false);
  });

  it("chave vazia é recusada", () => {
    expect(validar(schemaInscricao, { ...valida, p256dh: "" }).ok).toBe(false);
    expect(validar(schemaInscricao, { ...valida, auth: "" }).ok).toBe(false);
  });

  /**
   * Limite de tamanho porque isto vai para tabela que nenhum humano lê:
   * sem teto, um corpo grande vira lixo permanente que ninguém percebe.
   */
  it("endpoint absurdamente longo é recusado", () => {
    const r = validar(schemaInscricao, {
      ...valida,
      endpoint: `https://push.exemplo/${"x".repeat(1200)}`,
    });
    expect(r.ok).toBe(false);
  });
});
