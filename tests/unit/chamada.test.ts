/**
 * A mensagem pronta para chamar quem se candidatou (#493).
 *
 * Quem recebe uma mensagem sem contexto desconfia: ela traz o nome da pessoa,
 * o cargo da vaga e o nome de quem chama. E é só o ponto de partida — o
 * WhatsApp a abre escrita no campo, e a empresa edita antes de enviar.
 */
import { describe, expect, it } from "vitest";
import { mensagemParaCandidato, primeiroNome } from "@/lib/chamada";
import { whatsappLink } from "@/lib/format";

describe("mensagemParaCandidato", () => {
  const base = {
    candidato: "Maria da Silva",
    vaga: "Operador de Máquinas",
    empresa: "Agro Norte",
  };

  it("leva o nome da pessoa, o cargo da vaga e o nome da empresa", () => {
    const texto = mensagemParaCandidato(base);

    expect(texto).toContain("Olá, Maria!");
    expect(texto).toContain("Agro Norte");
    expect(texto).toContain("Operador de Máquinas");
    expect(texto).toContain("Lupa");
  });

  it("usa só o primeiro nome", () => {
    expect(mensagemParaCandidato(base)).not.toContain("da Silva");
  });

  it("nome vazio não vira 'Olá, !'", () => {
    const texto = mensagemParaCandidato({ ...base, candidato: "   " });

    expect(texto.startsWith("Olá! ")).toBe(true);
    expect(texto).not.toContain(", !");
  });

  /**
   * É o link que a empresa clica: a mensagem vai no `?text=`, que o WhatsApp
   * põe no campo de escrita, e não envia sozinho.
   */
  it("vai no link do WhatsApp como texto a editar, sem enviar", () => {
    const link = whatsappLink("66999110001", mensagemParaCandidato(base));

    expect(link.startsWith("https://wa.me/5566999110001?text=")).toBe(true);
    expect(decodeURIComponent(link.split("text=")[1])).toBe(
      mensagemParaCandidato(base),
    );
  });
});

describe("primeiroNome", () => {
  it("corta no primeiro espaço, e aguenta espaço sobrando", () => {
    expect(primeiroNome("  Maria   da Silva ")).toBe("Maria");
    expect(primeiroNome("Maria")).toBe("Maria");
    expect(primeiroNome("")).toBe("");
  });
});
