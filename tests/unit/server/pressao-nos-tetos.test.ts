/**
 * @vitest-environment node
 *
 * A agregação da pressão nos tetos (#207).
 *
 * O bloco existe porque duas decisões deste projeto dizem "quando aparecer
 * abuso medido" — e ninguém media. O que ele **não** é, e é o que estes
 * testes protegem: não é histórico (a fonte se apaga sozinha) e não é por
 * pessoa (a chave que ele agrega tem endereço de e-mail dentro).
 *
 * A função aqui é a mesma que o `schema.test.ts` compara, linha a linha,
 * com a view `metricas_pressao` rodando num Postgres de verdade. Duas
 * implementações de uma regra de agregação divergem sem ninguém ver; a
 * única defesa é executar as duas sobre a mesma entrada.
 */
import { describe, expect, it } from "vitest";
import {
  agregarPressao,
  type JanelaDeLimite,
  rotuloDaChave,
} from "@/server/metrics/tipos";

const AGORA = new Date("2026-09-14T12:00:00Z");
const DEPOIS = new Date("2026-09-14T12:10:00Z");
const ANTES = new Date("2026-09-14T11:50:00Z");

function janela(
  chave: string,
  tentativas: number,
  bloqueadoAte: Date | null = null,
): JanelaDeLimite {
  return { chave, tentativas, bloqueadoAte };
}

describe("rótulo de uma chave de limite", () => {
  /**
   * O nome da ação vem de `ORCAMENTOS`, literal do nosso código. É por isso
   * que ele pode ser mostrado: nada nele veio de quem usa o app.
   */
  it("chave de ação vira o nome da ação, sem o dono", () => {
    expect(rotuloDaChave("acao:vaga.publicar:u:9f3c-abc")).toBe(
      "vaga.publicar",
    );
    expect(rotuloDaChave("acao:candidatura.criar:o:187.1.2.3")).toBe(
      "candidatura.criar",
    );
  });

  /**
   * Este é o caso que decide o desenho inteiro. A chave de login é
   * `login:<e-mail>`: se o rótulo fosse a chave, o painel do admin viraria
   * uma lista de quem errou a senha hoje — e a lista de quem tem conta na
   * Lupa é a lista de quem está procurando emprego.
   */
  it("chave de autenticação vira só o prefixo — o e-mail fica para trás", () => {
    expect(rotuloDaChave("login:alguem@exemplo.com")).toBe("login");
    expect(rotuloDaChave("cadastro:187.1.2.3")).toBe("cadastro");
    expect(rotuloDaChave("recuperacao:187.1.2.3")).toBe("recuperacao");
  });

  it("chave sem dois-pontos é ela mesma", () => {
    expect(rotuloDaChave("solta")).toBe("solta");
  });
});

describe("agregação da pressão", () => {
  it("soma chamadas e conta chaves distintas por rótulo", () => {
    const linhas = agregarPressao(
      [
        janela("acao:vaga.publicar:u:a", 4),
        janela("acao:vaga.publicar:u:b", 7),
        janela("login:um@exemplo.com", 2),
      ],
      AGORA,
    );

    expect(linhas).toEqual([
      {
        rotulo: "vaga.publicar",
        chaves: 2,
        chamadas: 11,
        bloqueadas: 0,
        pico: 7,
      },
      { rotulo: "login", chaves: 1, chamadas: 2, bloqueadas: 0, pico: 2 },
    ]);
  });

  /**
   * `chaves` e `pico` juntos são o que separa trânsito de abuso, e por isso
   * os dois existem em vez de só o total.
   *
   * Trinta chamadas divididas por dez pessoas é uma tarde movimentada em
   * Sinop; as mesmas trinta numa chave só é uma pessoa — ou um script.
   * Somente a soma não distingue os dois, e a diferença é justamente a que
   * decide se há abuso.
   */
  it("o pico distingue muita gente de uma pessoa só", () => {
    const espalhado = agregarPressao(
      Array.from({ length: 10 }, (_, i) =>
        janela(`acao:candidatura.criar:u:${i}`, 3),
      ),
      AGORA,
    );
    const concentrado = agregarPressao(
      [janela("acao:candidatura.criar:u:unico", 30)],
      AGORA,
    );

    expect(espalhado[0].chamadas).toBe(concentrado[0].chamadas);
    expect(espalhado[0].pico).toBe(3);
    expect(concentrado[0].pico).toBe(30);
  });

  /**
   * Bloqueio vencido não é bloqueio. A tabela guarda `bloqueado_ate` mesmo
   * depois de passar — a limpeza só roda algumas janelas adiante —, então
   * contar a coluna sem comparar com a hora mostraria abuso de meia hora
   * atrás como se fosse agora, e o bloco existe justamente para dizer
   * "agora".
   */
  it("só conta bloqueio que ainda vale", () => {
    const linhas = agregarPressao(
      [
        janela("acao:vaga.publicar:u:a", 11, DEPOIS),
        janela("acao:vaga.publicar:u:b", 11, ANTES),
      ],
      AGORA,
    );

    expect(linhas[0].bloqueadas).toBe(1);
  });

  /** Bloqueio na frente: é o único número que muda uma decisão. */
  it("ordena por bloqueio antes de volume", () => {
    const linhas = agregarPressao(
      [
        janela("acao:perfil.conta:u:a", 500),
        janela("acao:avaliacao.criar:u:b", 6, DEPOIS),
      ],
      AGORA,
    );

    expect(linhas.map((l) => l.rotulo)).toEqual([
      "avaliacao.criar",
      "perfil.conta",
    ]);
  });

  /**
   * O contrato que não pode quebrar: nada que saia daqui identifica alguém.
   *
   * A entrada tem e-mail, id de usuário e endereço IP — é a chave crua da
   * tabela. A saída não pode ter nenhum dos três, em nenhum campo.
   */
  it("nada do que sai identifica quem estava do outro lado", () => {
    const linhas = agregarPressao(
      [
        janela("login:fulano@exemplo.com", 5, DEPOIS),
        janela("cadastro:187.45.9.2", 3),
        janela("acao:vaga.publicar:u:11111111-2222-3333-4444-555555555555", 9),
      ],
      AGORA,
    );

    const serializado = JSON.stringify(linhas);
    expect(serializado).not.toContain("fulano");
    expect(serializado).not.toContain("@");
    expect(serializado).not.toContain("187.45.9.2");
    expect(serializado).not.toContain("11111111");
  });

  it("sem janela nenhuma é lista vazia, não erro", () => {
    expect(agregarPressao([], AGORA)).toEqual([]);
  });
});
