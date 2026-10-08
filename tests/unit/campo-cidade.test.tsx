import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CampoCidade } from "@/components/campo-cidade";

/**
 * O seletor de cidade, em dois passos.
 *
 * Antes dividia o arquivo com o campo de bairro, que saiu (#321): não há
 * lista de bairros para o país, e o bairro de uma pessoa não decide nada
 * no produto. O que sobrou deste componente é só a cidade.
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

  it("avisa quem escolheu, já no formato gravado", async () => {
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
