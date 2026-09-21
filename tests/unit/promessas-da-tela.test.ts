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
/*
 * `src/server` entrou na varredura com a #237: a mensagem de erro interno
 * é texto que a pessoa lê, e morava fora do alcance de qualquer teste de
 * promessa por não estar numa tela.
 */
const SERVIDOR = join(process.cwd(), "src", "server");

/**
 * Recursos que a interface **não pode** oferecer como passo, e por quê.
 *
 * Sair desta lista é o critério de pronto da Issue correspondente: quando
 * a #120 entregar o envio de SMS, a linha do telefone sai daqui e o teste
 * deixa de cobrar.
 */
interface RecursoInexistente {
  termos: RegExp;
  recurso: string;
  issue: string;
  /**
   * Arquivos onde o termo pode aparecer, com a razão.
   *
   * Existe para um caso só, e ele é legítimo: o componente que **guarda** o
   * selo desligado até a #120 chegar. Sem a exceção, o teste ficaria
   * vermelho por código correto — e falso vermelho é o que ensina todo
   * mundo a ignorar teste, como este projeto já registrou com os dubles sem
   * `.limit()`.
   *
   * A exceção não é cheque em branco: há um segundo teste conferindo que o
   * arquivo isentado de fato mantém o selo desligado.
   */
  excecoes?: string[];
}

const AINDA_NAO_EXISTE: RecursoInexistente[] = [
  {
    termos: /verificar o telefone|verifique o telefone|verificação por SMS/i,
    recurso: "verificação de telefone",
    issue:
      "#120 — depende de provedor pago de SMS, e nada no código escreve " +
      "`telefone_verificado = true`",
  },
  /*
   * As três de baixo não são promessa de recurso inexistente — são
   * afirmação **falsa sobre dado pessoal** (#233), e uma delas aparecia no
   * instante do consentimento. É por isso que elas moram nesta lista, que
   * até então só cobrava funcionalidade.
   */
  {
    termos: /(CPF|CNPJ)[^.]*n[ãa]o fica/i,
    recurso: "o descarte de CPF ou CNPJ",
    issue:
      "#233 — os dois **ficam guardados**. CPF em `usuarios`, tabela sem " +
      "grant para `anon`; CNPJ em `perfis_empresa`, que é pública de " +
      "propósito, porque é registro público",
  },
  {
    termos: /CPF e CNPJ[^.]*Receita/i,
    recurso: "conferência de CPF na Receita",
    issue:
      "#120 — não existe consulta pública gratuita de CPF. Só o CNPJ vai " +
      "à BrasilAPI; o CPF é validado por dígito e por unicidade, e dizer " +
      "o contrário promete um rigor que não existe",
  },
  {
    termos: /imagem do documento|documento é exclu[íi]d/i,
    recurso: "armazenamento e descarte de imagem de documento",
    issue:
      "#233 — nenhuma imagem de documento jamais foi enviada; `Especie` " +
      'nunca teve "documento" nem "selfie". Descrever o descarte de ' +
      "algo que não existe é afirmação falsa de conformidade",
  },
  /*
   * As três de baixo vieram da varredura da #237, na home — a tela onde
   * alguém decide deixar um estranho entrar em casa. Selo que promete mais
   * do que confere é pior que selo nenhum: ele substitui o cuidado da
   * pessoa por uma garantia que ninguém deu.
   */
  {
    termos: /telefone verificado/i,
    recurso: "verificação de telefone",
    issue:
      "#120 — depende de provedor pago, e **nada no código escreve** " +
      "`telefone_verificado = true`. Em produção, zero contas reais o têm " +
      "e os 14 que exibiam o selo eram todos do seed",
    excecoes: ["components/verified-badge.tsx"],
  },
  {
    termos: /identidade confirmada|identidade verificada/i,
    recurso: "confirmação de identidade",
    issue:
      "#237 — CPF válido e único e CNPJ na Receita provam que o documento " +
      "existe, nunca que é de quem o digitou. Os próprios Termos de Uso " +
      "dizem isso; a home dizia o contrário",
  },
  /*
   * As duas de baixo entraram quando a home virou pública (#242), e são a
   * mesma afirmação num lugar pior: a **meta description**, que é o texto
   * que o buscador mostra como resumo. Ninguém precisa abrir o site para
   * ler a promessa — ela chega antes dele.
   *
   * "Perfis verificados", no plural, não nomeia um perfil que passou por
   * conferência: promete que todos passaram, e promete a conferência que
   * não existe.
   *
   * Nenhuma das duas precisa de exceção para `verified-badge.tsx`. O selo
   * se chama "Perfil verificado" — singular, sem o "com" — e nomear o
   * estado de um perfil que de fato passou continua sendo verdade. A
   * diferença entre as duas frases é exatamente a diferença entre
   * descrever um registro e vender uma garantia.
   */
  {
    /*
     * Qualquer sujeito plural, não só "perfis" (#243).
     *
     * A primeira versão desta regra dizia `/perfis verificados/` — escrita
     * olhando para as ocorrências que eu tinha na mão. A `metadata
     * .description` do site inteiro dizia "prestadores de serviço
     * verificados": mesma promessa, sujeito diferente, e passou batido
     * pela varredura que existia justamente para pegá-la. Regra que só
     * reconhece a redação que alguém já viu é uma lista disfarçada de
     * regra.
     */
    termos: /(perfis|prestadores|profissionais)[^.]{0,40}verificad[oa]s/i,
    recurso: "verificação de todos os perfis",
    issue:
      "#237 — o plural promete a plataforma inteira conferida. O que " +
      "existe é CPF válido e único, e CNPJ na Receita, um perfil por vez " +
      "— e nenhum dos dois prova identidade",
  },
  {
    termos: /com perfil verificado/i,
    recurso: "verificação de perfil como característica do produto",
    issue:
      "#237 — a chamada da home oferecia isso como o que a Lupa é, e não " +
      "como o estado de um anúncio. O selo continua valendo; o que não " +
      "vale é vendê-lo como promessa de entrada",
  },
  {
    termos: /já estamos sabendo/i,
    recurso: "monitoramento automático de erro",
    issue:
      "#237 — o Sentry está no bundle **sem DSN** em produção e não " +
      "reporta nada. A frase custa o relato: quem lê que já sabemos não " +
      "escreve para o suporte, e o defeito vive",
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
    } else if (nome.endsWith(".tsx") || nome.endsWith(".ts")) {
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

    for (const raiz of [APP, COMPONENTES, SERVIDOR]) {
      for (const arquivo of arquivosDeTela(raiz)) {
        const visivel = textoVisivel(readFileSync(arquivo, "utf8"));
        const curto = arquivo.replace(/\\/g, "/").split("/src/")[1];

        for (const { termos, recurso, issue, excecoes } of AINDA_NAO_EXISTE) {
          if (excecoes?.includes(curto)) continue;
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
   * A exceção do selo de telefone só vale enquanto ele estiver desligado.
   *
   * O componente guarda o rótulo para o dia em que a #120 entregar o envio
   * por SMS — e é por isso que ele é isentado. Mas se alguém ligar a
   * constante sem a #120, o selo volta a dizer "não verificado" para
   * sempre, que é exatamente o que a #209 tirou. Este teste é o que
   * transforma a isenção em algo com prazo.
   */
  it("o selo de telefone isentado continua desligado", () => {
    const fonte = readFileSync(join(COMPONENTES, "verified-badge.tsx"), "utf8");

    expect(
      fonte,
      "VERIFICACAO_DE_TELEFONE_EXISTE foi ligada sem a #120 entregar o " +
        "envio por SMS. Nada no código escreve `telefone_verificado = " +
        "true`, então o selo volta a dizer 'não verificado' para sempre.",
    ).toMatch(/VERIFICACAO_DE_TELEFONE_EXISTE\s*=\s*false/);
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
