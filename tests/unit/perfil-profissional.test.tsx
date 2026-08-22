/**
 * O perfil mostrava só os campos da conta — nome, e-mail, telefone. Isso
 * responde "quem é você no sistema", não "quem é você para quem contrata".
 *
 * Cada papel tem uma identidade profissional diferente, e o estado vazio
 * importa tanto quanto o preenchido: é o que diz à pessoa o que falta e
 * por que aquilo muda o resultado dela.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  PerfilCandidato,
  PerfilEmpresa,
  PerfilPrestador,
} from "@/components/perfil-profissional";
import type { CltProfile, Company, ProviderListing } from "@/lib/types";

const CURRICULO: CltProfile = {
  profile_id: "u1",
  desired_area: "Agronegócio",
  experiences: [],
  education: "Ensino médio completo",
  skills: ["CNH categoria C", "Colheitadeira"],
  resume_url: null,
  availability: "Imediata",
};

const ANUNCIO: ProviderListing = {
  profile_id: "u2",
  category_id: 1,
  description: "Instalações elétricas residenciais.",
  starting_price: 150,
  years_experience: 7,
  service_area: ["Centro", "Menezes"],
  photo_urls: [],
  avg_rating: 4.7,
  review_count: 3,
  full_name: "João Silva",
  phone: "66000000001",
  city: "Sinop",
  neighborhood: "Centro",
  avatar_url: null,
  phone_verified: true,
  doc_verified: true,
  category: { id: 1, slug: "eletricista", name: "Eletricista" },
} as ProviderListing;

const EMPRESA: Company = {
  profile_id: "u3",
  company_name: "Agro Norte Ltda.",
  cnpj: "11222333000181",
  logo_url: null,
  plan: "mensal",
};

describe("candidato", () => {
  it("sem currículo, explica o que empresas veem e o que falta", () => {
    render(<PerfilCandidato perfil={null} />);
    expect(screen.getByText(/currículo ainda está vazio/i)).toBeTruthy();
    expect(screen.getByRole("link", { name: /completar/i })).toBeTruthy();
  });

  it("com currículo, mostra área, formação e habilidades", () => {
    render(<PerfilCandidato perfil={CURRICULO} />);
    expect(screen.getByText("Agronegócio")).toBeTruthy();
    expect(screen.getByText("Ensino médio completo")).toBeTruthy();
    expect(screen.getByText("Colheitadeira")).toBeTruthy();
    expect(screen.getByText("Imediata")).toBeTruthy();
  });

  /**
   * Currículo fora da busca pública não é detalhe: pode custar o emprego
   * que a pessoa ainda tem. Quem preenche precisa saber disso.
   */
  it("diz que o currículo não aparece em busca pública", () => {
    render(<PerfilCandidato perfil={CURRICULO} />);
    expect(screen.getByText(/não aparecem em busca pública/i)).toBeTruthy();
  });

  it("campos ausentes não viram linha vazia", () => {
    render(
      <PerfilCandidato
        perfil={{
          ...CURRICULO,
          education: null,
          availability: null,
          skills: [],
        }}
      />,
    );
    expect(screen.queryByText("Formação")).toBeNull();
    expect(screen.queryByText("Disponibilidade")).toBeNull();
    expect(screen.queryByText("Habilidades")).toBeNull();
  });
});

describe("prestador", () => {
  it("sem anúncio, explica que não aparece na busca", () => {
    render(<PerfilPrestador perfil={null} />);
    expect(screen.getByText(/anúncio ainda não está no ar/i)).toBeTruthy();
  });

  it("mostra a nota com vírgula, como o público brasileiro lê", () => {
    render(<PerfilPrestador perfil={ANUNCIO} />);
    expect(screen.getByText("4,7")).toBeTruthy();
    expect(screen.getByText("(3)")).toBeTruthy();
  });

  it("mostra categoria, descrição, experiência e bairros", () => {
    render(<PerfilPrestador perfil={ANUNCIO} />);
    expect(screen.getByText("Eletricista")).toBeTruthy();
    expect(screen.getByText(/Instalações elétricas/)).toBeTruthy();
    expect(screen.getByText("7 anos")).toBeTruthy();
    expect(screen.getByText("Menezes")).toBeTruthy();
  });

  /** Ver o próprio anúncio como o cliente vê é o que revela o que falta. */
  it("leva ao próprio perfil público", () => {
    render(<PerfilPrestador perfil={ANUNCIO} />);
    expect(
      screen.getByRole("link", { name: /como o cliente vê/i }),
    ).toHaveAttribute("href", "/servicos/u2");
  });

  it("sem preço e sem experiência, não inventa valor", () => {
    render(
      <PerfilPrestador
        perfil={{ ...ANUNCIO, starting_price: null, years_experience: null }}
      />,
    );
    expect(screen.queryByText("Experiência")).toBeNull();
  });
});

describe("empresa", () => {
  it("sem empresa, explica o papel do CNPJ na confiança", () => {
    render(<PerfilEmpresa empresa={null} />);
    expect(screen.getByText(/Nenhuma empresa vinculada/i)).toBeTruthy();
    expect(screen.getByText(/anúncio falso/i)).toBeTruthy();
  });

  it("mostra razão social, CNPJ e plano", () => {
    render(<PerfilEmpresa empresa={EMPRESA} />);
    expect(screen.getByText("Agro Norte Ltda.")).toBeTruthy();
    expect(screen.getByText("11222333000181")).toBeTruthy();
    expect(screen.getByText("Plano mensal")).toBeTruthy();
  });

  it("plano de teste aparece como período de teste", () => {
    render(<PerfilEmpresa empresa={{ ...EMPRESA, plan: "trial" }} />);
    expect(screen.getByText("Período de teste")).toBeTruthy();
  });
});
