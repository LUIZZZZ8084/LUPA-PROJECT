import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  CampoBairro,
  CampoBairrosAtendidos,
  CampoCidade,
} from "@/components/cidade-e-bairro";
import { MAX_BAIRROS_ATENDIDOS } from "@/lib/constants";

/**
 * A regra que decide entre lista e texto livre.
 *
 * Ela existe porque não há lista de bairros dos municípios do país, e
 * exigir uma travaria o cadastro de quem mora fora de Sinop. É uma decisão
 * de produto com duas metades, e as duas precisam continuar funcionando:
 * quem está numa cidade com curadoria escolhe da lista, quem não está
 * digita.
 */

const cidade = () => screen.getByLabelText(/cidade/i) as HTMLSelectElement;
const estado = () => screen.getByLabelText(/estado/i) as HTMLSelectElement;

/**
 * Estado e cidade, em dois passos (#301): são 5.571 municípios, e o
 * celular baixa só as cidades do estado escolhido.
 */
describe("campo de cidade", () => {
  it("nenhum estado vem escolhido, e a cidade pede o estado primeiro", () => {
    render(<CampoCidade value="" onChange={() => {}} />);

    expect(estado().value).toBe("");
    expect([...cidade().options].map((o) => o.text)).toEqual([
      "Escolha o estado",
    ]);
  });

  it("com cidade salva, já abre no estado e na cidade dela", () => {
    render(<CampoCidade value="Sinop - MT" onChange={() => {}} />);

    expect(estado().value).toBe("MT");
    expect(cidade().value).toBe("Sinop - MT");
  });

  it("escolhido o estado, chegam as cidades dele — com o nome, sem a sigla", async () => {
    render(<CampoCidade value="" onChange={() => {}} />);

    fireEvent.change(estado(), { target: { value: "MT" } });

    // 142 de MT, mais a instrução no topo.
    await waitFor(() => expect(cidade().options).toHaveLength(143));
    const textos = [...cidade().options].map((o) => o.text);
    expect(textos).toContain("Sinop");
    expect(textos).toContain("Cuiabá");
    expect([...cidade().options].map((o) => o.value)).toContain("Sinop - MT");
  });

  it("avisa quem escolheu, já no formato gravado, para o bairro reagir", async () => {
    const escolhas: string[] = [];
    render(
      <CampoCidade value="Sinop - MT" onChange={(c) => escolhas.push(c)} />,
    );

    await waitFor(() => expect(cidade().options.length).toBeGreaterThan(100));
    fireEvent.change(cidade(), { target: { value: "Sorriso - MT" } });

    expect(escolhas).toEqual(["Sorriso - MT"]);
  });

  /*
   * Cidade de um estado com outro estado escolhido não existe: trocar o
   * estado tem de soltar a cidade, senão o formulário mandaria "Sinop -
   * MT" com SP na tela.
   */
  it("trocar o estado solta a cidade", () => {
    const escolhas: string[] = [];
    render(
      <CampoCidade value="Sinop - MT" onChange={(c) => escolhas.push(c)} />,
    );

    fireEvent.change(estado(), { target: { value: "SP" } });

    expect(escolhas).toEqual([""]);
  });
});

describe("campo de bairro", () => {
  it("em cidade com curadoria, é uma lista", () => {
    render(<CampoBairro cidade="Sinop - MT" />);

    const select = screen.getByLabelText(/bairro/i) as HTMLSelectElement;
    expect(select.tagName).toBe("SELECT");
    expect(screen.getByRole("option", { name: "Centro" })).toBeTruthy();
    // "Não informar" existe: bairro é opcional.
    expect(screen.getByRole("option", { name: /não informar/i })).toBeTruthy();
  });

  it("em cidade sem curadoria, é texto — e diz por quê", () => {
    render(<CampoBairro cidade="Cuiabá - MT" />);

    const campo = screen.getByLabelText(/bairro/i) as HTMLInputElement;
    expect(campo.tagName).toBe("INPUT");
    expect(screen.getByText(/lista de bairros de Cuiabá/i)).toBeTruthy();
  });

  /*
   * O valor guardado continua chegando na tela mesmo onde não há lista —
   * senão editar o telefone apagaria o bairro de quem mora em Sorriso.
   */
  it("texto livre começa com o que já estava salvo", () => {
    render(<CampoBairro cidade="Sorriso - MT" defaultValue="Jardim Itália" />);

    const campo = screen.getByLabelText(/bairro/i) as HTMLInputElement;
    expect(campo.value).toBe("Jardim Itália");
  });

  it("bairro salvo fora da lista não força uma opção errada", () => {
    // Cidade com lista, valor que não está nela: melhor vazio do que
    // gravar por engano o primeiro bairro do `select`.
    render(<CampoBairro cidade="Sinop - MT" defaultValue="Bairro Novo" />);

    const select = screen.getByLabelText(/bairro/i) as HTMLSelectElement;
    expect(select.value).toBe("");
  });
});

describe("bairros atendidos, do prestador", () => {
  it("com lista, são caixas de seleção", () => {
    render(
      <CampoBairrosAtendidos cidade="Sinop - MT" selecionados={["Centro"]} />,
    );

    const marcadas = screen
      .getAllByRole("checkbox")
      .filter((c) => (c as HTMLInputElement).checked)
      .map((c) => (c as HTMLInputElement).value);

    expect(marcadas).toEqual(["Centro"]);
  });

  it("sem lista, é texto separado por vírgula", () => {
    render(<CampoBairrosAtendidos cidade="Cuiabá - MT" selecionados={[]} />);

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
      <CampoBairrosAtendidos cidade="Cuiabá - MT" selecionados={[]} />,
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
      <CampoBairrosAtendidos cidade="Cuiabá - MT" selecionados={[]} />,
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
        cidade="Cuiabá - MT"
        selecionados={["Centro", "Coxipó"]}
      />,
    );

    expect(
      (screen.getByLabelText(/bairros atendidos/i) as HTMLInputElement).value,
    ).toBe("Centro, Coxipó");
  });
});
