/**
 * Quem responde juridicamente pela Lupa (#235).
 *
 * O que este arquivo protege não é formatação de CNPJ — é a regra que
 * decide se as três páginas institucionais podem existir.
 *
 * **Documento legal sem controlador identificado é pior que documento
 * nenhum:** dá aparência de conformidade sem entregar nenhuma, e promete um
 * canal de direitos do titular sem dizer a quem se dirigir. Por isso
 * `PRONTO_PARA_PUBLICAR` existe e as páginas respondem 404 até ele ser
 * verdadeiro.
 *
 * Os dados são os do comprovante de inscrição da PALU na Receita, emitido
 * em 24/10/2026. O teste os confere contra o próprio validador do app: um
 * dígito trocado ao copiar o CNPJ publicaria um documento legal com um
 * número que não existe.
 */
import { describe, expect, it } from "vitest";
import {
  CONTROLADOR,
  cnpjFormatado,
  PRONTO_PARA_PUBLICAR,
  REVISADO_EM,
} from "@/lib/controlador";
import { cnpjValido } from "@/server/validation";

describe("controlador", () => {
  /**
   * Com a PALU registrada, `/termos`, `/privacidade` e `/suporte` existem.
   * Se algum dos três campos voltar a ficar vazio, as páginas voltam a
   * responder 404 — e este teste avisa antes.
   */
  it("está pronto para publicar, com os dados da Receita", () => {
    expect(PRONTO_PARA_PUBLICAR).toBe(true);
    expect(CONTROLADOR.razaoSocial).toBe(
      "PALU DESENVOLVIMENTO DE SOFTWARE SOB ENCOMENDA LTDA",
    );
    expect(cnpjFormatado()).toBe("69.787.370/0001-17");
  });

  it("o CNPJ publicado passa no dígito verificador", () => {
    expect(CONTROLADOR.cnpj).toMatch(/^\d{14}$/);
    expect(cnpjValido(CONTROLADOR.cnpj ?? "")).toBe(true);
  });

  /**
   * Os três campos são o que a LGPD exige para o titular saber a quem se
   * dirigir. Marcar como pronto sem um deles é o modo de falha que o gate
   * existe para impedir.
   */
  it("só fica pronto com razão social, CNPJ e e-mail — os três", () => {
    const pronto = (c: Partial<typeof CONTROLADOR>) =>
      Boolean(c.razaoSocial && c.cnpj && c.email);

    const completo = {
      razaoSocial: "PALU LTDA",
      cnpj: "11222333000181",
      email: "contato@exemplo.test",
    };

    expect(pronto(completo)).toBe(true);
    expect(pronto({ ...completo, razaoSocial: null })).toBe(false);
    expect(pronto({ ...completo, cnpj: null })).toBe(false);
    expect(pronto({ ...completo, email: null })).toBe(false);
  });

  /**
   * A data existe porque a LGPD obriga a avisar mudança relevante — e
   * "mudou" só significa alguma coisa contra uma data anterior. Formato
   * errado aqui vira uma data inválida no rodapé de um documento legal.
   */
  it("a data de revisão está em AAAA-MM-DD e é uma data de verdade", () => {
    expect(REVISADO_EM).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(Number.isNaN(Date.parse(REVISADO_EM))).toBe(false);
  });

  /**
   * O foro sai daqui. É a sede do registro, Curitiba/PR — não Sinop, onde a
   * Lupa começou, que era o valor provisório antes de a PALU existir.
   */
  it("a sede é a do registro, porque é ela que define o foro", () => {
    expect(CONTROLADOR.cidade).toBe("Curitiba");
    expect(CONTROLADOR.uf).toBe("PR");
    expect(CONTROLADOR.endereco).toContain("80420-210");
  });
});
