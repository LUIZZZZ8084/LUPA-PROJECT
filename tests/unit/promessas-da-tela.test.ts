/**
 * Nenhuma tela promete o que o app não tem (#209).
 *
 * Este projeto já pagou duas vezes pela mesma coisa. As telas do prestador
 * diziam "envie documento e selfie em Editar perfil" e **nenhuma tela de
 * envio jamais existiu** — corrigido na #133. E o cadastro dizia, para
 * todo candidato recém-criado, "o próximo passo é verificar o telefone",
 * apontando para uma verificação que depende da #120 e de um provedor
 * pago.
 *
 * As duas passaram batido pelo mesmo motivo: **o texto lê bem**. Nada
 * quebra, nada fica vermelho, e quem revisa lê uma frase responsável. Quem
 * descobre é a pessoa que procura a tela, não acha, e conclui alguma coisa
 * sobre o app.
 *
 * Por isso a trava é um teste que lê o código-fonte da interface e cobra a
 * outra ponta: se a tela cita o recurso, o recurso precisa existir.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const APP = join(process.cwd(), "src", "app");
const COMPONENTES = join(process.cwd(), "src", "components");

/**
 * Recursos que a interface **não pode** oferecer como passo, e por quê.
 *
 * Sair desta lista é o critério de pronto da Issue correspondente: quando
 * a #120 entregar o envio de SMS, a linha do telefone sai daqui e o teste
 * deixa de cobrar.
 */
const AINDA_NAO_EXISTE: { termos: RegExp; recurso: string; issue: string }[] = [
  {
    termos: /verificar o telefone|verifique o telefone|verificação por SMS/i,
    recurso: "verificação de telefone",
    issue:
      "#120 — depende de provedor pago de SMS, e nada no código escreve " +
      "`telefone_verificado = true`",
  },
  {
    termos: /envie (o )?(documento|selfie)|documento e selfie/i,
    recurso: "envio de documento e selfie",
    issue:
      "#133 trocou isso por CPF válido e único; `Especie` nunca teve " +
      '"documento" nem "selfie"',
  },
];

function arquivosDeTela(dir: string): string[] {
  const achados: string[] = [];
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) {
      achados.push(...arquivosDeTela(caminho));
    } else if (nome.endsWith(".tsx")) {
      achados.push(caminho);
    }
  }
  return achados;
}

/**
 * Só o que a pessoa lê.
 *
 * Comentário que **explica** por que a promessa saiu não pode fazer o
 * teste falhar — senão o jeito de passar vira apagar a explicação, que é
 * justamente o que se quer manter.
 */
function textoVisivel(fonte: string): string {
  return (
    fonte
      // `{/* ... */}` primeiro: o stripper de `/* ... */` consumiria o miolo
      // e deixaria as chaves para trás, e o comentário voltaria a contar
      // como texto visível.
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "")
  );
}

describe("promessas da tela", () => {
  it("nenhuma tela oferece um passo que não existe", () => {
    const quebradas: string[] = [];

    for (const raiz of [APP, COMPONENTES]) {
      for (const arquivo of arquivosDeTela(raiz)) {
        const visivel = textoVisivel(readFileSync(arquivo, "utf8"));
        const curto = arquivo.replace(/\\/g, "/").split("/src/")[1];

        for (const { termos, recurso, issue } of AINDA_NAO_EXISTE) {
          if (termos.test(visivel)) {
            quebradas.push(`${curto} — oferece ${recurso} (${issue})`);
          }
        }
      }
    }

    expect(
      quebradas,
      "Tela prometendo o que o app não tem.\n\n" +
        quebradas.map((q) => `  • ${q}`).join("\n") +
        "\n\nOu o recurso passa a existir, ou a frase muda para algo que " +
        "leve a uma tela que existe. Promessa na tela é contrato.",
    ).toEqual([]);
  });

  /**
   * A lista envelhece pelo lado bom: quando o recurso chega, a entrada
   * precisa sair — senão ela passa a proibir uma frase que já é verdade.
   */
  it("a lista de recursos inexistentes tem motivo escrito", () => {
    for (const { recurso, issue } of AINDA_NAO_EXISTE) {
      expect(issue.length, `${recurso} sem motivo`).toBeGreaterThan(20);
      expect(issue, `${recurso} sem Issue`).toMatch(/#\d+/);
    }
  });
});
