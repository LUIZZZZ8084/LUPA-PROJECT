/**
 * A regra da vitrine, num lugar só (#256).
 *
 * Estava escrita no filtro SQL e no da demonstração, e o aviso do perfil
 * ia ser a terceira cópia — foi numa cópia que ela ficou para trás.
 */
import { describe, expect, it } from "vitest";
import { motivoForaDaVitrine } from "@/lib/vitrine";

describe("motivoForaDaVitrine", () => {
  it("sem documento, o documento é o motivo — mesmo com assinatura", () => {
    // A ordem é a de quem resolve: sem documento, assinar não adianta.
    expect(
      motivoForaDaVitrine({
        docVerificado: false,
        mensalidadeValidaAte: "2099-12-31T00:00:00Z",
      }),
    ).toBe("documento");
  });

  it("com documento e sem assinatura, a assinatura é o motivo", () => {
    expect(
      motivoForaDaVitrine({ docVerificado: true, mensalidadeValidaAte: null }),
    ).toBe("assinatura");
  });

  it("assinatura vencida é o mesmo que não ter", () => {
    expect(
      motivoForaDaVitrine({
        docVerificado: true,
        mensalidadeValidaAte: "2020-01-01T00:00:00Z",
      }),
    ).toBe("assinatura");
  });

  it("com os dois em dia, está na vitrine", () => {
    expect(
      motivoForaDaVitrine({
        docVerificado: true,
        mensalidadeValidaAte: "2099-12-31T00:00:00Z",
      }),
    ).toBeNull();
  });
});
