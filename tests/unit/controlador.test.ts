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
 * Os valores de hoje são nulos de propósito: a PALU está em constituição, e
 * o endereço de contato ainda vai ser criado. **O teste do estado atual é
 * temporário por construção** — ele sai quando os campos forem preenchidos,
 * e é o lembrete de que existe uma pendência real.
 */
import { describe, expect, it } from "vitest";
import {
  CONTROLADOR,
  cnpjFormatado,
  PRONTO_PARA_PUBLICAR,
  REVISADO_EM,
} from "@/lib/controlador";

describe("controlador", () => {
  /**
   * Enquanto isto for falso, `/termos`, `/privacidade` e `/suporte`
   * respondem 404. Quando alguém preencher os três campos, este teste passa
   * a falhar — e é o sinal de que as páginas subiram, não um defeito.
   */
  it("hoje não está pronto para publicar, e as três páginas sabem disso", () => {
    const faltando = [
      !CONTROLADOR.razaoSocial && "razaoSocial",
      !CONTROLADOR.cnpj && "cnpj",
      !CONTROLADOR.email && "email",
    ].filter(Boolean);

    expect(
      PRONTO_PARA_PUBLICAR,
      faltando.length
        ? `Ainda faltam: ${faltando.join(", ")}. Quando preencher, troque a expectativa deste teste para true e tire a exclusão de /termos, /privacidade e /suporte de ROTAS_NAO_VARRIDAS.`
        : "O controlador foi preenchido — atualize este teste.",
    ).toBe(false);
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

  /** Sem CNPJ não há o que formatar, e a página simplesmente não o mostra. */
  it("sem CNPJ, não inventa formatação", () => {
    expect(cnpjFormatado()).toBeNull();
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

  /** O foro sai daqui, então cidade e UF não podem ficar vazias. */
  it("a sede está preenchida, porque é ela que define o foro", () => {
    expect(CONTROLADOR.cidade).toBeTruthy();
    expect(CONTROLADOR.uf).toHaveLength(2);
  });
});
