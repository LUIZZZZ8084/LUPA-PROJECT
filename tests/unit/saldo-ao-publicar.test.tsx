/**
 * O saldo aparece **antes** do formulário, e a recusa oferece a saída
 * (#193).
 *
 * O aviso morava no rodapé, em 12px cinza-claro, e dizia só *que* publicar
 * usa uma vaga — nunca quantas a pessoa tem. Quem estava zerado preenchia
 * dez campos para descobrir no fim, e a recusa era texto vermelho sem
 * botão: saindo da tela para procurar onde comprar, perdia tudo, porque os
 * campos vivem no DOM.
 *
 * Este arquivo trava os três estados do aviso e a saída da recusa. É teste
 * de componente, e não e2e, por uma razão prática: a conta compartilhada da
 * suíte compra quatro pacotes no setup, então "sem saldo" exigiria gastar
 * quarenta vagas para chegar no estado que mais importa.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/app/(app)/_contratacao/nova-vaga-actions", () => ({
  publicarVagaComEstado: async () => ({}),
}));

const { NewJobForm } = await import("@/app/(app)/_contratacao/nova-vaga-form");
const { AREA_EMPRESA, AREA_PRESTADOR } = await import(
  "@/app/(app)/_contratacao/area"
);

function montar(
  direito: { mensalAtivo: boolean; creditos: number },
  area = AREA_EMPRESA,
) {
  render(<NewJobForm cidadeDaEmpresa="Sinop" area={area} direito={direito} />);
}

describe("aviso de saldo ao publicar", () => {
  it("com saldo, diz o número em vez de um aviso genérico", () => {
    montar({ mensalAtivo: false, creditos: 7 });
    expect(screen.getByText("Você tem 7 vagas para publicar")).toBeTruthy();
  });

  it("uma vaga só não vira plural", () => {
    montar({ mensalAtivo: false, creditos: 1 });
    expect(screen.getByText("Você tem 1 vaga para publicar")).toBeTruthy();
  });

  /**
   * O estado que motivou a mudança: avisar antes, e já oferecer a compra.
   *
   * Sem isto a pessoa escreve a vaga inteira para ser barrada no fim — e
   * a recusa, por mais correta que seja, chega tarde demais para ser útil.
   */
  it("sem saldo, alerta antes do formulário e já oferece comprar", () => {
    montar({ mensalAtivo: false, creditos: 0 });

    expect(screen.getByText("Você não tem vagas para publicar")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: /comprar vagas/i }),
    ).toHaveAttribute("href", "/empresa/creditos");
  });

  /** Quem paga o mensal não conta saldo, e a tela não fala de saldo. */
  it("com plano mensal, fala do plano e não de saldo", () => {
    montar({ mensalAtivo: true, creditos: 0 });

    expect(screen.getByText("Plano mensal ativo")).toBeTruthy();
    expect(screen.queryByText(/vagas para publicar/i)).toBeNull();
  });

  /**
   * O botão aponta para a área de quem está publicando.
   *
   * As duas rotas renderizam a mesma implementação desde a #189; um
   * caminho escrito à mão aqui mandaria o prestador para a área da
   * empresa, que é o que aquela mudança veio desfazer.
   */
  it("o caminho de comprar acompanha a área do papel", () => {
    montar({ mensalAtivo: false, creditos: 0 }, AREA_PRESTADOR);

    expect(
      screen.getByRole("link", { name: /comprar vagas/i }),
    ).toHaveAttribute("href", "/contratar/creditos");
  });
});
