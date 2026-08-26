import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  CampoBairro,
  CampoBairrosAtendidos,
  CampoCidade,
} from "@/components/cidade-e-bairro";
import { CIDADES, MAX_BAIRROS_ATENDIDOS } from "@/lib/constants";

/**
 * A regra que decide entre lista e texto livre.
 *
 * Ela existe porque não há lista de bairros dos 142 municípios de Mato
 * Grosso, e exigir uma travaria o cadastro de quem mora fora de Sinop. É
 * uma decisão de produto com duas metades, e as duas precisam continuar
 * funcionando: quem está numa cidade com curadoria escolhe da lista, quem
 * não está digita.
 */

describe("campo de cidade", () => {
  /*
   * Timeout maior só aqui.
   *
   * O `select` tem 142 opções de verdade — é o estado inteiro —, e
   * `getByRole("option", …)` monta a árvore de acessibilidade das 142 para
   * achar uma. Sozinho o teste roda em menos de um segundo; junto com a
   * suíte, em dois trabalhadores, passava dos cinco e o vermelho aparecia
   * em quem não tinha culpa.
   *
   * Não é defeito escondido: o mesmo caso está no e2e, num navegador de
   * verdade, onde a consulta é nativa.
   */
  it("oferece o estado inteiro, com o estado no rótulo", () => {
    render(<CampoCidade value="Sinop" onChange={() => {}} />);

    const select = screen.getByLabelText(/cidade/i) as HTMLSelectElement;
    expect(select.options).toHaveLength(CIDADES.length);
    expect(select.value).toBe("Sinop");

    // Pelo DOM, e não por `getByRole`: a consulta por papel percorre as 142
    // opções montando a árvore de acessibilidade de cada uma.
    const textos = [...select.options].map((o) => o.text);
    expect(textos).toContain("Cuiabá - MT");
    expect(textos).toContain("Sinop - MT");
  }, 15_000);

  it("avisa quem escolheu, para o bairro poder reagir", () => {
    const escolhas: string[] = [];
    render(<CampoCidade value="Sinop" onChange={(c) => escolhas.push(c)} />);

    fireEvent.change(screen.getByLabelText(/cidade/i), {
      target: { value: "Sorriso" },
    });

    expect(escolhas).toEqual(["Sorriso"]);
  });
});

describe("campo de bairro", () => {
  it("em cidade com curadoria, é uma lista", () => {
    render(<CampoBairro cidade="Sinop" />);

    const select = screen.getByLabelText(/bairro/i) as HTMLSelectElement;
    expect(select.tagName).toBe("SELECT");
    expect(screen.getByRole("option", { name: "Centro" })).toBeTruthy();
    // "Não informar" existe: bairro é opcional.
    expect(screen.getByRole("option", { name: /não informar/i })).toBeTruthy();
  });

  it("em cidade sem curadoria, é texto — e diz por quê", () => {
    render(<CampoBairro cidade="Cuiabá" />);

    const campo = screen.getByLabelText(/bairro/i) as HTMLInputElement;
    expect(campo.tagName).toBe("INPUT");
    expect(screen.getByText(/lista de bairros de Cuiabá/i)).toBeTruthy();
  });

  /*
   * O valor guardado continua chegando na tela mesmo onde não há lista —
   * senão editar o telefone apagaria o bairro de quem mora em Sorriso.
   */
  it("texto livre começa com o que já estava salvo", () => {
    render(<CampoBairro cidade="Sorriso" defaultValue="Jardim Itália" />);

    const campo = screen.getByLabelText(/bairro/i) as HTMLInputElement;
    expect(campo.value).toBe("Jardim Itália");
  });

  it("bairro salvo fora da lista não força uma opção errada", () => {
    // Cidade com lista, valor que não está nela: melhor vazio do que
    // gravar por engano o primeiro bairro do `select`.
    render(<CampoBairro cidade="Sinop" defaultValue="Bairro Novo" />);

    const select = screen.getByLabelText(/bairro/i) as HTMLSelectElement;
    expect(select.value).toBe("");
  });
});

describe("bairros atendidos, do prestador", () => {
  it("com lista, são caixas de seleção", () => {
    render(<CampoBairrosAtendidos cidade="Sinop" selecionados={["Centro"]} />);

    const marcadas = screen
      .getAllByRole("checkbox")
      .filter((c) => (c as HTMLInputElement).checked)
      .map((c) => (c as HTMLInputElement).value);

    expect(marcadas).toEqual(["Centro"]);
  });

  it("sem lista, é texto separado por vírgula", () => {
    render(<CampoBairrosAtendidos cidade="Cuiabá" selecionados={[]} />);

    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    expect(screen.getByLabelText(/bairros atendidos/i).tagName).toBe("INPUT");
  });

  /*
   * O servidor recebe a mesma forma nos dois modos — um campo por bairro,
   * com o mesmo `name`. Sem isso, a regra de separação viveria em dois
   * lugares: na tela e no servidor.
   */
  it("o texto vira um campo por bairro, como as caixas fariam", () => {
    const { container } = render(
      <CampoBairrosAtendidos cidade="Cuiabá" selecionados={[]} />,
    );

    fireEvent.change(screen.getByLabelText(/bairros atendidos/i), {
      target: { value: "Centro, Jardim das Américas ,, Coxipó " },
    });

    const enviados = [
      ...container.querySelectorAll<HTMLInputElement>(
        'input[type="hidden"][name="bairrosAtendidos"]',
      ),
    ].map((i) => i.value);

    // Espaço em volta some, vazio entre vírgulas não vira bairro.
    expect(enviados).toEqual(["Centro", "Jardim das Américas", "Coxipó"]);
  });

  it("corta no limite em vez de mandar lista sem fim", () => {
    const { container } = render(
      <CampoBairrosAtendidos cidade="Cuiabá" selecionados={[]} />,
    );

    const muitos = Array.from(
      { length: MAX_BAIRROS_ATENDIDOS + 5 },
      (_, i) => `Bairro ${i}`,
    ).join(", ");

    fireEvent.change(screen.getByLabelText(/bairros atendidos/i), {
      target: { value: muitos },
    });

    expect(container.querySelectorAll('input[type="hidden"]')).toHaveLength(
      MAX_BAIRROS_ATENDIDOS,
    );
  });

  it("começa preenchido com o que o prestador já atendia", () => {
    render(
      <CampoBairrosAtendidos
        cidade="Cuiabá"
        selecionados={["Centro", "Coxipó"]}
      />,
    );

    expect(
      (screen.getByLabelText(/bairros atendidos/i) as HTMLInputElement).value,
    ).toBe("Centro, Coxipó");
  });
});
