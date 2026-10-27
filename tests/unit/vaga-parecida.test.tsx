/**
 * Publicar outra vaga parecida (#492): o formulário abre preenchido com o
 * texto de uma vaga antiga da própria empresa.
 *
 * Só preenche — nada vai ao ar sem a revisão, e a vaga nova gasta uma vaga do
 * saldo como qualquer outra. O que se prova é que cada campo recebe o valor
 * certo, inclusive os que são rádio e seleção, e que sem modelo o formulário
 * abre vazio como sempre.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DadosDaVaga } from "@/app/(app)/_contratacao/revisao";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/app/(app)/_contratacao/nova-vaga-actions", () => ({
  publicarVagaComEstado: async () => ({}),
}));

const { NewJobForm } = await import("@/app/(app)/_contratacao/nova-vaga-form");
const { AREA_EMPRESA } = await import("@/app/(app)/_contratacao/area");

const MODELO: Omit<DadosDaVaga, "perguntas"> = {
  titulo: "Motorista de Carreta",
  categoria: "Logística e Transporte",
  tipoContrato: "CLT",
  modalidade: "presencial",
  paraPcd: "nao",
  cidade: "Sorriso - MT",
  bairro: "Centro",
  endereco: "Rua das Palmeiras, 50",
  habilidades: "CNH E, direção defensiva",
  salarioMin: "3500",
  salarioMax: "4200",
  descricao: "Transporte de grãos entre Sorriso e os portos do Norte.",
};

const DIREITO = {
  pode: true,
  mensalAtivo: false,
  limiteNoAr: null,
  noAr: 0,
  planoCheio: false,
  creditos: 3,
  primeiraGratis: false,
};

function montar(modelo?: Omit<DadosDaVaga, "perguntas"> | null) {
  return render(
    <NewJobForm
      cidadeDaEmpresa="Sinop - MT"
      area={AREA_EMPRESA}
      direito={DIREITO}
      modelo={modelo}
    />,
  );
}

const campo = (nome: string) =>
  document.querySelector(`[name="${nome}"]`) as HTMLInputElement;

describe("formulário com modelo de vaga", () => {
  it("preenche os campos de texto com o que a vaga antiga dizia", () => {
    montar(MODELO);

    expect(campo("titulo").value).toBe("Motorista de Carreta");
    expect(campo("bairro").value).toBe("Centro");
    expect(campo("endereco").value).toBe("Rua das Palmeiras, 50");
    expect(campo("habilidades").value).toBe("CNH E, direção defensiva");
    expect(campo("salarioMin").value).toBe("3500");
    expect(campo("salarioMax").value).toBe("4200");
    expect(campo("descricao").value).toContain("Transporte de grãos");
  });

  it("marca as seleções e os rádios", () => {
    montar(MODELO);

    expect(campo("categoria").value).toBe("Logística e Transporte");
    expect(campo("tipoContrato").value).toBe("CLT");
    expect(
      (screen.getByLabelText("Presencial") as HTMLInputElement).checked,
    ).toBe(true);
    expect(
      (screen.getByLabelText("Home office") as HTMLInputElement).checked,
    ).toBe(false);
    expect(
      (screen.getByLabelText("Não é para PCD") as HTMLInputElement).checked,
    ).toBe(true);
    expect(
      (screen.getByLabelText("Sim, é para PCD") as HTMLInputElement).checked,
    ).toBe(false);
  });

  it("vaga para PCD marca o outro rádio", () => {
    montar({ ...MODELO, paraPcd: "sim" });

    expect(
      (screen.getByLabelText("Sim, é para PCD") as HTMLInputElement).checked,
    ).toBe(true);
  });

  it("avisa de onde veio o texto, e que a revisão vem antes de ir ao ar", () => {
    montar(MODELO);

    expect(screen.getByText(/Preenchido com o texto de/)).toBeTruthy();
    expect(screen.getByText(/a revisão vem antes de ir ao ar/)).toBeTruthy();
  });

  /** Sem modelo, o formulário é o de sempre: vazio, e sem o aviso. */
  it("sem modelo, abre vazio e sem aviso", () => {
    montar(null);

    expect(campo("titulo").value).toBe("");
    expect(campo("descricao").value).toBe("");
    expect(campo("categoria").value).toBe("");
    expect(screen.queryByText(/Preenchido com o texto de/)).toBeNull();
    for (const radio of screen.getAllByRole("radio")) {
      expect((radio as HTMLInputElement).checked).toBe(false);
    }
  });

  it("vaga antiga sem endereço nem salário não vira 'undefined'", () => {
    montar({
      ...MODELO,
      endereco: "",
      bairro: "",
      salarioMin: "",
      salarioMax: "",
    });

    expect(campo("endereco").value).toBe("");
    expect(campo("salarioMin").value).toBe("");
  });
});
