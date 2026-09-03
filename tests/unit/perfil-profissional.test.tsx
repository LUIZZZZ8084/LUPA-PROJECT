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
import type { ProviderListing } from "@/lib/types";
import type {
  PerfilCandidato as DadosCandidato,
  PerfilEmpresa as DadosEmpresa,
  PerfilPrestador as DadosPrestador,
} from "@/server/repositories/tipos";

const CURRICULO: DadosCandidato = {
  usuarioId: "u1",
  areaDesejada: "Agronegócio",
  resumo: null,
  curriculoUrl: null,
  disponibilidade: "Imediata",
  formacao: "Ensino médio completo",
  habilidades: ["CNH categoria C", "Colheitadeira"],
  visivelParaEmpresas: false,
};

const ANUNCIO: DadosPrestador = {
  usuarioId: "u2",
  categoriaId: 1,
  descricao: "Instalações elétricas residenciais.",
  precoInicial: 150,
  anosExperiencia: 7,
  bairrosAtendidos: ["Centro", "Menezes"],
  instagram: null,
  facebook: null,
};

/** Só nota e contagem: o resto do anúncio vem do perfil. */
const LISTAGEM = { avg_rating: 4.7, review_count: 3 } as ProviderListing;

const EMPRESA: DadosEmpresa = {
  usuarioId: "u3",
  razaoSocial: "Agro Norte Ltda.",
  cnpj: "11222333000181",
  setor: null,
  porte: null,
  site: null,
  instagram: null,
  facebook: null,
  descricao: null,
  logoUrl: null,
  plano: "mensal",
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
          formacao: null,
          disponibilidade: null,
          habilidades: [],
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
    render(<PerfilPrestador perfil={null} listagem={null} docVerificado />);
    expect(screen.getByText(/anúncio ainda não está no ar/i)).toBeTruthy();
  });

  it("mostra a nota com vírgula, como o público brasileiro lê", () => {
    render(<PerfilPrestador perfil={ANUNCIO} listagem={LISTAGEM} docVerificado />);
    expect(screen.getByText("4,7")).toBeTruthy();
    expect(screen.getByText("(3)")).toBeTruthy();
  });

  it("mostra categoria, descrição, experiência e bairros", () => {
    render(<PerfilPrestador perfil={ANUNCIO} listagem={LISTAGEM} docVerificado />);
    expect(screen.getByText("Eletricista")).toBeTruthy();
    expect(screen.getByText(/Instalações elétricas/)).toBeTruthy();
    expect(screen.getByText("7 anos")).toBeTruthy();
    expect(screen.getByText("Menezes")).toBeTruthy();
  });

  /** Ver o próprio anúncio como o cliente vê é o que revela o que falta. */
  it("leva ao próprio perfil público", () => {
    render(<PerfilPrestador perfil={ANUNCIO} listagem={LISTAGEM} docVerificado />);
    expect(
      screen.getByRole("link", { name: /como o cliente vê/i }),
    ).toHaveAttribute("href", "/servicos/u2");
  });

  it("sem preço e sem experiência, não inventa valor", () => {
    render(
      <PerfilPrestador
        perfil={{ ...ANUNCIO, precoInicial: null, anosExperiencia: null }}
        listagem={LISTAGEM} docVerificado
      />,
    );
    expect(screen.queryByText("Experiência")).toBeNull();
  });

  it("sem instagram nem facebook, não mostra nenhum link", () => {
    render(<PerfilPrestador perfil={ANUNCIO} listagem={LISTAGEM} docVerificado />);
    expect(screen.queryByRole("link", { name: "Instagram" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Facebook" })).toBeNull();
  });

  it("com instagram, mostra o link", () => {
    render(
      <PerfilPrestador
        perfil={{ ...ANUNCIO, instagram: "https://instagram.com/fulano" }}
        listagem={LISTAGEM} docVerificado
      />,
    );
    expect(screen.getByRole("link", { name: "Instagram" })).toHaveAttribute(
      "href",
      "https://instagram.com/fulano",
    );
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
    render(<PerfilEmpresa empresa={{ ...EMPRESA, plano: "trial" }} />);
    expect(screen.getByText("Período de teste")).toBeTruthy();
  });

  /**
   * `site` existia no banco havia tempo e nunca tinha aparecido em lugar
   * nenhum — nem aqui, nem em tela pública. Este teste é o que trava essa
   * regressão específica de volta.
   */
  it("mostra o site, quando preenchido", () => {
    render(
      <PerfilEmpresa
        empresa={{ ...EMPRESA, site: "https://agronorte.com.br" }}
      />,
    );
    expect(screen.getByRole("link", { name: "Site" })).toHaveAttribute(
      "href",
      "https://agronorte.com.br",
    );
  });

  it("sem site, instagram nem facebook, não mostra nenhum link", () => {
    render(<PerfilEmpresa empresa={EMPRESA} />);
    expect(screen.queryByRole("link", { name: "Site" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Instagram" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Facebook" })).toBeNull();
  });
});
