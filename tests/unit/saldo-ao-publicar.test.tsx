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
 * quarenta vagas para chegar no estado que mais importa. O mesmo vale
 * para o plano cheio (#489): chegar nele pelo navegador exigiria publicar
 * cinco vagas de verdade.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DireitoParaTela } from "@/lib/planos-empresa";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/app/(app)/_contratacao/nova-vaga-actions", () => ({
  publicarVagaComEstado: async () => ({}),
}));

const { NewJobForm } = await import("@/app/(app)/_contratacao/nova-vaga-form");
const { AREA_EMPRESA, AREA_PRESTADOR } = await import(
  "@/app/(app)/_contratacao/area"
);

/**
 * O direito completo, com o que cada teste não menciona no valor neutro:
 * sem plano, nada no ar e sem a primeira vaga grátis.
 */
function direitoDe(parcial: Partial<DireitoParaTela> = {}): DireitoParaTela {
  const base = {
    mensalAtivo: false,
    limiteNoAr: null,
    noAr: 0,
    planoCheio: false,
    creditos: 0,
    primeiraGratis: false,
    ...parcial,
  };
  return {
    ...base,
    pode:
      parcial.pode ??
      ((base.mensalAtivo && !base.planoCheio) ||
        base.creditos > 0 ||
        base.primeiraGratis),
  };
}

function montar(parcial: Partial<DireitoParaTela>, area = AREA_EMPRESA) {
  render(
    <NewJobForm
      cidadeDaEmpresa="Sinop - MT"
      area={area}
      direito={direitoDe(parcial)}
    />,
  );
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
      screen.getByRole("link", { name: /ver planos e vagas/i }),
    ).toHaveAttribute("href", "/empresa/creditos");
  });

  /** Quem paga o ilimitado não conta saldo, e a tela não fala de saldo. */
  it("com plano ilimitado, fala do plano e não de saldo", () => {
    montar({ mensalAtivo: true, creditos: 0 });

    expect(screen.getByText("Plano ilimitado ativo")).toBeTruthy();
    expect(screen.queryByText(/vagas para publicar/i)).toBeNull();
    expect(
      screen.queryByRole("link", { name: /ver planos e vagas/i }),
    ).toBeNull();
  });

  it("com plano de 5, diz quantas vagas cabem ainda", () => {
    montar({ mensalAtivo: true, limiteNoAr: 5, noAr: 3 });

    expect(screen.getByText("Plano de 5: 3 no ar")).toBeTruthy();
    expect(screen.getByText(/cabem mais 2 vagas/i)).toBeTruthy();
  });

  it("falta uma vaga no plano: o texto fica no singular", () => {
    montar({ mensalAtivo: true, limiteNoAr: 5, noAr: 4 });

    expect(screen.getByText(/cabem mais 1 vaga,/i)).toBeTruthy();
  });

  /**
   * O plano cheio é o estado novo (#489): a empresa tem plano, e mesmo
   * assim não publica. A tela diz isso **antes** do formulário — e
   * oferece a saída, que é a mesma da falta de saldo.
   */
  it("com o plano cheio, alerta antes do formulário e oferece a saída", () => {
    montar({ mensalAtivo: true, limiteNoAr: 5, noAr: 5, planoCheio: true });

    expect(
      screen.getByText(/seu plano está cheio: 5 de 5 no ar/i),
    ).toBeTruthy();
    expect(screen.getByText(/encerre uma vaga/i)).toBeTruthy();
    expect(
      screen.getByRole("link", { name: /ver planos e vagas/i }),
    ).toHaveAttribute("href", "/empresa/creditos");
  });

  it("com o plano cheio mas uma avulsa no saldo, diz que ela será usada", () => {
    montar({
      mensalAtivo: true,
      limiteNoAr: 5,
      noAr: 5,
      planoCheio: true,
      creditos: 1,
    });

    expect(screen.getByText(/usa uma vaga avulsa do saldo/i)).toBeTruthy();
    expect(
      screen.queryByRole("link", { name: /ver planos e vagas/i }),
    ).toBeNull();
  });

  it("a primeira vaga grátis é anunciada, sem pedir compra", () => {
    montar({ primeiraGratis: true });

    expect(screen.getByText(/primeira vaga é por nossa conta/i)).toBeTruthy();
    expect(
      screen.queryByRole("link", { name: /ver planos e vagas/i }),
    ).toBeNull();
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
      screen.getByRole("link", { name: /ver planos e vagas/i }),
    ).toHaveAttribute("href", "/contratar/creditos");
  });
});
