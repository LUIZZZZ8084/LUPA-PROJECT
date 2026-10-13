/**
 * @vitest-environment node
 *
 * O `robots.txt` é público e não anuncia a área administrativa (#439).
 *
 * `/admin` responde 404 a quem não é admin justamente para não confirmar
 * que existe (AGENTS.md, "404 em vez de 403"); listá-la no `robots.txt`
 * desfazia isso para qualquer um. E nenhum crawler chega lá sem sessão: o
 * muro do login responde antes.
 */
import { describe, expect, it } from "vitest";
import robots from "@/app/robots";

describe("robots.txt", () => {
  const { rules } = robots();
  const regras = Array.isArray(rules) ? rules : [rules];
  const bloqueadas = regras.flatMap((r) =>
    Array.isArray(r.disallow) ? r.disallow : r.disallow ? [r.disallow] : [],
  );

  it("não menciona a área administrativa", () => {
    expect(bloqueadas.some((c) => c.startsWith("/admin"))).toBe(false);
  });

  it("continua fechando as áreas de quem tem conta", () => {
    expect(bloqueadas).toEqual(
      expect.arrayContaining(["/vagas", "/perfil", "/api/"]),
    );
  });
});
