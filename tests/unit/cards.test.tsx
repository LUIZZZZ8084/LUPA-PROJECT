import { render, screen } from "@testing-library/react";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { JobCard } from "@/components/job-card";
import { ProviderCard } from "@/components/provider-card";
import { MOCK_JOBS, MOCK_PROVIDERS } from "@/lib/mock-data";

const job = MOCK_JOBS[0];
const provider = MOCK_PROVIDERS[0];

describe("JobCard", () => {
  it("mostra cargo, empresa e salário", () => {
    render(<JobCard job={job} />);
    expect(screen.getByText(job.title)).toBeInTheDocument();
    expect(screen.getByText(job.company.company_name)).toBeInTheDocument();
    expect(screen.getByText(/R\$/)).toBeInTheDocument();
  });

  it("leva para o detalhe da vaga", () => {
    render(<JobCard job={job} />);
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      `/vagas/${job.id}`,
    );
  });

  it("marca como nova apenas dentro de 24h", () => {
    const { unmount } = render(<JobCard job={job} />);
    expect(screen.getByText("Novo")).toBeInTheDocument();
    unmount();

    const antiga = {
      ...job,
      created_at: new Date(Date.now() - 3 * 86_400_000).toISOString(),
    };
    render(<JobCard job={antiga} />);
    expect(screen.queryByText("Novo")).not.toBeInTheDocument();
  });

  it("mostra 'A combinar' quando não há salário", () => {
    render(<JobCard job={{ ...job, salary_min: null, salary_max: null }} />);
    expect(screen.getByText("A combinar")).toBeInTheDocument();
  });
});

describe("ProviderCard", () => {
  it("mostra nome, categoria e preço inicial", () => {
    render(<ProviderCard provider={provider} />);
    expect(screen.getByText(provider.full_name)).toBeInTheDocument();
    expect(screen.getByText(provider.category.name)).toBeInTheDocument();
  });

  it("expõe a nota de forma acessível", () => {
    render(<ProviderCard provider={provider} />);
    expect(
      screen.getByLabelText(new RegExp(`${provider.review_count} avaliações`)),
    ).toBeInTheDocument();
  });

  it("informa quando não há avaliações, em vez de mostrar nota zero", () => {
    render(
      <ProviderCard
        provider={{ ...provider, avg_rating: 0, review_count: 0 }}
      />,
    );
    expect(screen.getByText("Sem avaliações")).toBeInTheDocument();
  });

  it("mostra o selo apenas para documento verificado", () => {
    const { unmount } = render(<ProviderCard provider={provider} />);
    expect(screen.getByLabelText("Perfil verificado")).toBeInTheDocument();
    unmount();

    render(<ProviderCard provider={{ ...provider, doc_verified: false }} />);
    expect(screen.queryByLabelText("Perfil verificado")).not.toBeInTheDocument();
  });
});

/**
 * Regressão de layout.
 *
 * `truncate` num elemento que também é `flex` não corta o texto: o ellipsis
 * não se aplica e o `white-space: nowrap` trava a largura, empurrando a
 * página para fora da tela no celular. O truncate tem que ficar num filho
 * de texto. jsdom não calcula layout, então a trava é sobre o código-fonte.
 */
describe("contrato de layout", () => {
  const arquivos = readdirSync("src", { recursive: true, encoding: "utf8" })
    .filter((f) => f.endsWith(".tsx"))
    .map((f) => join("src", f));

  it("nenhum elemento combina `flex` com `truncate`", () => {
    const infratores: string[] = [];

    for (const arquivo of arquivos) {
      const conteudo = readFileSync(arquivo, "utf8");
      const classNames = conteudo.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g);

      for (const m of classNames) {
        const classes = (m[1] ?? m[2] ?? "").split(/\s+/);
        const temFlex = classes.some((c) => c === "flex" || c === "inline-flex");
        const temTruncate = classes.includes("truncate");
        if (temFlex && temTruncate) {
          infratores.push(`${arquivo}: ${(m[1] ?? m[2] ?? "").slice(0, 70)}`);
        }
      }
    }

    expect(infratores).toEqual([]);
  });

  it("as grades de cards declaram coluna única explícita no mobile", () => {
    const infratores: string[] = [];

    for (const arquivo of arquivos) {
      const conteudo = readFileSync(arquivo, "utf8");
      // Sem `grid-cols-1`, a coluna implícita é dimensionada por min-content
      // e o card impõe largura mínima maior que a tela.
      for (const m of conteudo.matchAll(/className="([^"]*\bgrid\b[^"]*)"/g)) {
        const classes = m[1];
        const semBreakpoints = classes.replace(
          /\b(sm|md|lg|xl|2xl):grid-cols-\S+/g,
          "",
        );
        if (
          /\b(sm|md|lg|xl|2xl):grid-cols-\d/.test(classes) &&
          !/\bgrid-cols-\S+/.test(semBreakpoints)
        ) {
          infratores.push(`${arquivo}: ${classes.slice(0, 70)}`);
        }
      }
    }

    expect(infratores).toEqual([]);
  });
});
