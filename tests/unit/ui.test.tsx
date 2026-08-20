import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Avatar } from "@/components/ui/avatar";
import { Badge, Meta } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardTitle, Panel, Stat } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { RatingInline, Stars } from "@/components/ui/stars";
import { VerificationRow, VerifiedMark } from "@/components/verified-badge";

describe("Button", () => {
  it("dispara o clique", async () => {
    const aoClicar = vi.fn();
    render(<Button onClick={aoClicar}>Candidatar-se</Button>);
    await userEvent.click(screen.getByRole("button"));
    expect(aoClicar).toHaveBeenCalledOnce();
  });

  it("não dispara quando desabilitado", async () => {
    const aoClicar = vi.fn();
    render(
      <Button onClick={aoClicar} disabled>
        Enviar
      </Button>,
    );
    await userEvent.click(screen.getByRole("button"));
    expect(aoClicar).not.toHaveBeenCalled();
  });

  it("aplica a cor da vertical", () => {
    const { rerender } = render(<Button variant="servicos">Ir</Button>);
    expect(screen.getByRole("button").className).toContain("bg-servicos");
    rerender(<Button variant="empresas">Ir</Button>);
    expect(screen.getByRole("button").className).toContain("bg-empresas");
  });

  it("ButtonLink vira âncora com href", () => {
    render(<ButtonLink href="/vagas">Ver vagas</ButtonLink>);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/vagas");
  });
});

describe("Avatar", () => {
  it("mostra iniciais quando não há foto", () => {
    render(<Avatar name="João Silva" />);
    expect(screen.getByText("JS")).toBeInTheDocument();
  });

  it("usa a foto quando existe, com carregamento tardio", () => {
    render(<Avatar name="João Silva" src="/foto.jpg" />);
    const img = screen.getByRole("img", { name: "João Silva" });
    expect(img).toHaveAttribute("src", "/foto.jpg");
    expect(img).toHaveAttribute("loading", "lazy");
  });
});

describe("Stars", () => {
  it("anuncia a nota para leitor de tela", () => {
    render(<Stars rating={4.5} />);
    expect(screen.getByLabelText("Nota 4,5 de 5")).toBeInTheDocument();
  });

  it("RatingInline mostra nota e contagem", () => {
    render(<RatingInline rating={4.8} count={27} />);
    expect(screen.getByText("4,8")).toBeInTheDocument();
    expect(screen.getByText("(27)")).toBeInTheDocument();
  });

  it("RatingInline avisa quando não há avaliação, sem mostrar zero", () => {
    render(<RatingInline rating={0} count={0} />);
    expect(screen.getByText("Sem avaliações")).toBeInTheDocument();
    expect(screen.queryByText("0,0")).not.toBeInTheDocument();
  });
});

describe("selos de verificação", () => {
  it("VerifiedMark tem rótulo acessível", () => {
    render(<VerifiedMark />);
    expect(screen.getByLabelText("Perfil verificado")).toBeInTheDocument();
  });

  it("VerificationRow distingue verificado de não verificado", () => {
    render(<VerificationRow phoneVerified docVerified={false} />);
    expect(screen.getByText("Telefone verificado")).toBeInTheDocument();
    expect(screen.getByText("Documento não verificado")).toBeInTheDocument();
  });
});

describe("Field", () => {
  it("associa rótulo ao campo", async () => {
    render(
      <Field label="WhatsApp">
        <Input name="phone" />
      </Field>,
    );
    const campo = screen.getByLabelText(/WhatsApp/);
    await userEvent.type(campo, "66999");
    expect(campo).toHaveValue("66999");
  });

  it("marca campo obrigatório", () => {
    render(
      <Field label="E-mail" required>
        <Input />
      </Field>,
    );
    expect(screen.getByLabelText("obrigatório")).toBeInTheDocument();
  });

  it("mostra a dica, e o erro substitui a dica", () => {
    const { rerender } = render(
      <Field label="Senha" hint="Mínimo de 8 caracteres">
        <Input />
      </Field>,
    );
    expect(screen.getByText("Mínimo de 8 caracteres")).toBeInTheDocument();

    rerender(
      <Field label="Senha" hint="Mínimo de 8 caracteres" error="Muito curta">
        <Input />
      </Field>,
    );
    expect(screen.getByText("Muito curta")).toBeInTheDocument();
    expect(
      screen.queryByText("Mínimo de 8 caracteres"),
    ).not.toBeInTheDocument();
  });

  it("Select e Textarea aceitam interação", async () => {
    render(
      <>
        <Field label="Categoria">
          <Select>
            <option value="">Escolha</option>
            <option value="eletricista">Eletricista</option>
          </Select>
        </Field>
        <Field label="Sobre">
          <Textarea />
        </Field>
      </>,
    );

    await userEvent.selectOptions(
      screen.getByLabelText("Categoria"),
      "eletricista",
    );
    expect(screen.getByLabelText("Categoria")).toHaveValue("eletricista");

    await userEvent.type(screen.getByLabelText("Sobre"), "Faço instalações");
    expect(screen.getByLabelText("Sobre")).toHaveValue("Faço instalações");
  });
});

describe("Card e Badge", () => {
  it("renderiza o conteúdo", () => {
    render(
      <Card>
        <CardTitle>Operador de Máquinas</CardTitle>
        <CardBody>Agro Norte</CardBody>
      </Card>,
    );
    expect(
      screen.getByRole("heading", { name: "Operador de Máquinas" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Agro Norte")).toBeInTheDocument();
  });

  it("Panel envolve uma seção", () => {
    render(<Panel>conteúdo do painel</Panel>);
    expect(screen.getByText("conteúdo do painel")).toBeInTheDocument();
  });

  it("Stat mostra valor e rótulo", () => {
    render(<Stat label="Vagas ativas" value={5} />);
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("Vagas ativas")).toBeInTheDocument();
  });

  it("Badge aplica a cor do tom", () => {
    render(<Badge tone="vagas">Novo</Badge>);
    expect(screen.getByText("Novo").className).toContain("text-vagas");
  });

  it("Meta renderiza ícone e texto", () => {
    render(<Meta icon={<span data-testid="icone" />}>Sinop</Meta>);
    expect(screen.getByTestId("icone")).toBeInTheDocument();
    expect(screen.getByText("Sinop")).toBeInTheDocument();
  });
});
