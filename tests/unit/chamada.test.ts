/**
 * A mensagem pronta para chamar quem se candidatou (#493).
 *
 * Quem recebe uma mensagem sem contexto desconfia: ela traz o nome da pessoa,
 * o cargo da vaga e o nome de quem chama. E é só o ponto de partida — o
 * WhatsApp a abre escrita no campo, e a empresa edita antes de enviar.
 */
import { describe, expect, it } from "vitest";
import {
  mensagemParaCandidato,
  mensagemParaEmpresa,
  primeiroNome,
} from "@/lib/chamada";
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

/**
 * O caminho de volta (#533): o candidato chama a empresa. A mensagem diz de
 * qual vaga fala, com o link dela, declara o interesse e traz o link do
 * perfil — é por ele que a empresa abre o currículo e põe a pessoa no funil.
 */
describe("mensagemParaEmpresa", () => {
  const base = {
    empresa: "Agro Norte",
    candidato: "Maria da Silva",
    vaga: "Operador de Máquinas",
    linkDaVaga: "https://lupapp.com.br/vagas/v1",
    linkDoPerfil: "https://lupapp.com.br/candidatos/u1",
  };

  it("diz quem é, para qual empresa e para qual vaga, com o link dela", () => {
    const texto = mensagemParaEmpresa(base);

    expect(texto).toContain("Olá, Agro Norte!");
    expect(texto).toContain("Me chamo Maria da Silva");
    expect(texto).toContain(
      "Operador de Máquinas (https://lupapp.com.br/vagas/v1)",
    );
  });

  it("declara o interesse e a disponibilidade para entrevista", () => {
    const texto = mensagemParaEmpresa(base);

    expect(texto).toContain("tenho interesse na vaga");
    expect(texto).toContain("eventual entrevista");
  });

  it("termina com o link do perfil e currículo", () => {
    expect(
      mensagemParaEmpresa(base).endsWith(
        "Este é o link do meu perfil e currículo: https://lupapp.com.br/candidatos/u1",
      ),
    ).toBe(true);
  });

  /**
   * As quebras de linha e os links viajam no `?text=`: o WhatsApp precisa
   * receber a mensagem inteira, sem cortar no `?` ou no `&` de um link.
   */
  it("cabe inteira no link do WhatsApp", () => {
    const texto = mensagemParaEmpresa({
      ...base,
      linkDoPerfil: "https://lupapp.com.br/candidatos/u1?a=1&b=2",
    });
    const url = new URL(whatsappLink("66999990000", texto));

    expect(url.searchParams.get("text")).toBe(texto);
  });
});
