/**
 * A página para empresas semana a semana (#568) e as varreduras (#566), no
 * painel do admin.
 *
 * O que se prova: a semana começa na segunda-feira e a vazia aparece com
 * zero; a visita e a conta caem na semana certa; a tela lê da semana atual
 * para trás, com a conversão e um traço quando não houve visita; e a
 * varredura atrasada diz o que conferir.
 */
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PaginaDeEmpresas } from "@/app/(app)/admin/painel/pagina-de-empresas";
import { Varreduras } from "@/app/(app)/admin/painel/varreduras";
import { inicioDasSemanas, semanasDaPagina } from "@/server/metrics/tipos";
import { situacaoDasVarreduras } from "@/server/varreduras/tipos";

// Sexta-feira, 06/11/2026: a semana começou na segunda, 02/11.
const AGORA = new Date("2026-11-06T13:00:00.000Z");

describe("semanas da página para empresas", () => {
  it("oito semanas, da segunda de sete semanas atrás até a atual", () => {
    expect(inicioDasSemanas(AGORA, 8)).toBe("2026-09-14");
    const semanas = semanasDaPagina([], [], AGORA);
    expect(semanas).toHaveLength(8);
    expect(semanas[0].inicio).toBe("2026-09-14");
    expect(semanas[7]).toEqual({ inicio: "2026-11-02", visitas: 0, contas: 0 });
  });

  it("visita e conta caem na semana delas; domingo ainda é da semana anterior", () => {
    const semanas = semanasDaPagina(
      [
        { dia: "2026-11-01", total: 4 }, // domingo
        { dia: "2026-11-02", total: 5 }, // segunda
        { dia: "2026-11-06", total: 1 },
        { dia: "2026-01-01", total: 99 }, // fora da janela
      ],
      ["2026-11-04T18:30:00.000Z", "2026-10-28T10:00:00.000Z"],
      AGORA,
    );
    const porInicio = new Map(semanas.map((s) => [s.inicio, s]));
    expect(porInicio.get("2026-11-02")).toEqual({
      inicio: "2026-11-02",
      visitas: 6,
      contas: 1,
    });
    expect(porInicio.get("2026-10-26")).toEqual({
      inicio: "2026-10-26",
      visitas: 4,
      contas: 1,
    });
    expect(semanas.reduce((s, l) => s + l.visitas, 0)).toBe(10);
  });
});

describe("PaginaDeEmpresas", () => {
  it("da semana atual para trás, com a conversão de cada uma", () => {
    render(
      <PaginaDeEmpresas
        semanas={[
          { inicio: "2026-10-27", visitas: 0, contas: 0 },
          { inicio: "2026-11-03", visitas: 8, contas: 2 },
        ]}
      />,
    );

    const linhas = screen.getAllByRole("row").slice(1);
    expect(within(linhas[0]).getByRole("rowheader")).toHaveTextContent(
      "03/11(esta)",
    );
    expect(linhas[0]).toHaveTextContent("8225%");
    // Sem visita não há conta a fazer: traço, e não 0% nem NaN.
    expect(linhas[1]).toHaveTextContent("27/1000—");
    expect(screen.getByText(/de conversão/).closest("p")).toHaveTextContent(
      "8 visitas e 2 contas em 2 semanas — 25% de conversão",
    );
  });
});

describe("Varreduras", () => {
  it("em dia: quando rodou e o resumo por extenso", () => {
    const umaHora = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    render(
      <Varreduras
        varreduras={situacaoDasVarreduras(
          [
            {
              nome: "avisar-vagas-vencendo",
              rodouEm: umaHora,
              ok: true,
              resumo: { vagasVencendo: 1, empresasAvisadas: 0 },
              ultimaOkEm: umaHora,
            },
          ],
          new Date(),
        )}
      />,
    );

    expect(screen.getByText("Rodou há 1h")).toBeInTheDocument();
    expect(
      screen.getByText("1 vaga vencendo · 0 empresas avisadas"),
    ).toBeInTheDocument();
    // A outra ainda não rodou depois do deploy: sem alarme.
    expect(screen.getByText(/Ainda sem registro/)).toBeInTheDocument();
    expect(screen.queryByText("Atrasada")).toBeNull();
  });

  it("atrasada: o selo, há quanto tempo foi o último sucesso e o que conferir", () => {
    const agora = new Date();
    const horas = (h: number) =>
      new Date(agora.getTime() - h * 60 * 60 * 1000).toISOString();
    render(
      <Varreduras
        varreduras={situacaoDasVarreduras(
          [
            {
              nome: "reconciliar-pagamentos",
              rodouEm: horas(2),
              ok: false,
              resumo: { erro: "CRON_SECRET ausente" },
              ultimaOkEm: horas(50),
            },
          ],
          agora,
        )}
      />,
    );

    expect(screen.getByText("Atrasada")).toBeInTheDocument();
    expect(screen.getByText("erro: CRON_SECRET ausente")).toBeInTheDocument();
    expect(
      screen.getByText(
        /Sem sucesso há mais de 26 horas \(o último foi há 2d\)/,
      ),
    ).toHaveTextContent(/Confira o CRON_SECRET/);
  });
});
