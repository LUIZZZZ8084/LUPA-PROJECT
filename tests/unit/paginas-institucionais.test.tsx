/**
 * Os documentos legais dizem o que o produto faz (#235).
 *
 * Um documento legal é a quinta ocorrência da mesma armadilha deste
 * projeto: texto que lê bem, que ninguém executa, e que descreve um produto
 * que não existe. As quatro anteriores custaram uma tela quebrada; esta
 * custaria uma obrigação assumida por escrito.
 *
 * Foi escrevendo estes documentos que a #233 apareceu — três telas
 * afirmando que CPF e CNPJ não ficavam guardados. **Método que isso
 * ensinou: documento legal se escreve a partir do banco, não a partir do
 * que o produto diz de si.** Estes testes são o que mantém os dois juntos.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/controlador", () => ({
  CONTROLADOR: {
    nomeFantasia: "Lupa",
    razaoSocial: "PALU LTDA",
    cnpj: "11222333000181",
    email: "contato@exemplo.test",
    cidade: "Sinop",
    uf: "MT",
  },
  PRONTO_PARA_PUBLICAR: true,
  REVISADO_EM: "2026-09-14",
  cnpjFormatado: () => "11.222.333/0001-81",
}));

import PrivacidadePage from "@/app/(app)/privacidade/page";
import TermosPage from "@/app/(app)/termos/page";
import { PRECO_CENTAVOS } from "@/server/pagamentos/planos";

describe("Termos de Uso", () => {
  /**
   * A posição que o documento inteiro sustenta, e o motivo de ele existir:
   * a Lupa divulga e aproxima, e não entra na relação que os dois criarem.
   * Se esta frase sair, o documento passa a admitir o contrário por
   * omissão.
   */
  it("diz o que a Lupa não é", () => {
    render(<TermosPage />);

    expect(screen.getByText(/Não é empregadora/)).toBeInTheDocument();
    expect(
      screen.getByText(/não intermedeia e não fiscaliza/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Não garante contratação/)).toBeInTheDocument();
  });

  /**
   * O ponto juridicamente mais sensível do produto: a Lupa cobra de quem
   * procura emprego (o gerador de currículo). O documento precisa dizer,
   * com todas as letras, que esse pagamento não compra colocação — senão a
   * cobrança fica indistinguível de taxa de intermediação de emprego.
   */
  it("deixa claro que o que o candidato paga não compra vaga", () => {
    const { container } = render(<TermosPage />);
    const texto = container.textContent ?? "";

    expect(texto).toMatch(/não compra vaga/i);
    expect(texto).toMatch(/não dá prioridade/);
    expect(texto).toMatch(/Nenhum pagamento na Lupa compra colocação/);
  });

  /**
   * Preço digitado à mão num documento legal deixa de ser inconveniente e
   * vira publicidade enganosa. Ele vem de `PRECO_CENTAVOS`, a mesma fonte
   * da tela de compra — e este teste falha se alguém mudar o preço e
   * esquecer que ele aparece aqui.
   */
  it("os preços vêm da fonte única, e batem com o que se cobra", () => {
    const { container } = render(<TermosPage />);
    /*
     * Espaço normalizado: `formatMoneyBRL` usa espaço não separável entre
     * "R$" e o número, e o texto ainda atravessa elementos. Comparar o
     * documento inteiro é o que mede a pergunta certa — o preço aparece —
     * sem depender de onde a marcação o quebrou.
     */
    const texto = (container.textContent ?? "").replace(/\s+/g, " ");

    for (const centavos of [
      PRECO_CENTAVOS.prestador_mensalidade,
      PRECO_CENTAVOS.empresa_vaga_avulsa,
      PRECO_CENTAVOS.empresa_mensal,
      PRECO_CENTAVOS.curriculo_pdf,
    ]) {
      const esperado = (centavos / 100).toFixed(2).replace(".", ",");
      expect(texto, `preço ${esperado} não aparece nos Termos`).toContain(
        esperado,
      );
    }
  });

  /**
   * Os dois apoios legais que o documento invoca. Citados por número
   * porque quem lê precisa poder conferir — e porque um documento que
   * afirma "não respondo pelo que publicam" sem dizer com base em quê é
   * afirmação, não fundamento.
   */
  it("cita o Marco Civil e o CDC pelos artigos", () => {
    render(<TermosPage />);

    expect(screen.getByText(/art. 19 da Lei 12.965\/2014/)).toBeInTheDocument();
    expect(
      screen.getByText(/art. 49 do Código de Defesa do Consumidor/),
    ).toBeInTheDocument();
  });

  /**
   * O direito de arrependimento do art. 49 vale para **toda** compra feita
   * à distância, e não só para a assinatura. O app hoje só implementa
   * devolução da primeira mensalidade; o direito existe de qualquer forma,
   * e o documento não pode prometer menos do que a lei dá.
   */
  it("o arrependimento de 7 dias vale para qualquer compra", () => {
    render(<TermosPage />);
    expect(
      screen.getByText(/qualquer\s+compra feita aqui/i),
    ).toBeInTheDocument();
  });
});

describe("Política de Privacidade", () => {
  /**
   * A seção que carrega o peso deste app. A diferença entre um dado
   * fechado e um dado na vitrine não é detalhe técnico: numa cidade do
   * tamanho de Sinop, currículo visível é a informação de que alguém quer
   * sair do emprego atual.
   */
  it("separa o que é público do que nunca é", () => {
    render(<PrivacidadePage />);

    expect(screen.getByText("Fica visível")).toBeInTheDocument();
    expect(screen.getByText("Nunca fica visível")).toBeInTheDocument();
    expect(screen.getByText(/Seu CPF\./)).toBeInTheDocument();
  });

  /**
   * O contrário do que as telas diziam até a #233. Se este teste falhar
   * porque o texto mudou para "não guardamos", é sinal de que alguém
   * reescreveu o documento a partir da tela outra vez.
   */
  it("admite que guarda o CPF, e diz onde", () => {
    render(<PrivacidadePage />);
    expect(
      screen.getByText(/Fica numa área que só o servidor alcança/),
    ).toBeInTheDocument();
  });

  /** Sem base legal declarada, a LGPD não é cumprida — é citada. */
  it("declara as bases legais do art. 7º", () => {
    render(<PrivacidadePage />);

    for (const base of [
      "Execução do contrato",
      "Obrigação legal",
      "Consentimento",
      "Legítimo interesse",
    ]) {
      expect(screen.getByText(base)).toBeInTheDocument();
    }
  });

  /**
   * Cada operador é nomeado. "Parceiros de confiança" é a fórmula que não
   * informa nada — o titular tem direito de saber com quem, pelo art. 18,
   * inciso VII.
   */
  it("nomeia cada operador, um a um", () => {
    render(<PrivacidadePage />);

    for (const operador of [
      "Supabase",
      "Vercel",
      "Mercado Pago",
      "Resend",
      "BrasilAPI",
    ]) {
      expect(screen.getByText(operador)).toBeInTheDocument();
    }
  });

  /**
   * A promessa mais forte do documento, e a mais fácil de quebrar sem
   * perceber no dia em que aparecer uma proposta de anúncio.
   */
  it("promete não vender dado", () => {
    render(<PrivacidadePage />);
    expect(screen.getByText(/Não vendemos dado seu/)).toBeInTheDocument();
  });
});
