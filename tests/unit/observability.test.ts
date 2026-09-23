import { describe, expect, it } from "vitest";
import {
  IGNORED_ERRORS,
  scrubSensitiveData,
  TRACES_SAMPLE_RATE,
} from "@/lib/observability";

/**
 * Estes testes protegem uma obrigação legal, não uma preferência.
 *
 * A Lupa trata telefone, CPF, CNPJ e imagem de documento. Nada disso pode
 * sair para um serviço de terceiro junto com um relatório de erro. Se um
 * destes testes cair, há vazamento de dado pessoal em produção.
 */
describe("scrubSensitiveData", () => {
  it("remove o valor de campos com nome sensível", () => {
    const evento = {
      user: { phone: "66999110001", nome: "João" },
      extra: { cpf: "123.456.789-00", senha: "segredo123" },
    };

    const limpo = scrubSensitiveData(evento);

    expect(limpo.user.phone).toBe("[removido]");
    expect(limpo.extra.cpf).toBe("[removido]");
    expect(limpo.extra.senha).toBe("[removido]");
    // O que não é sensível permanece, senão o relatório perde utilidade.
    expect(limpo.user.nome).toBe("João");
  });

  it("cobre as variações de nome usadas no schema", () => {
    const evento = {
      telefone: "x",
      whatsapp: "x",
      cnpj: "x",
      documento: "x",
      selfie: "x",
      password: "x",
      token: "x",
      secret: "x",
      resume_url: "x",
      curriculo: "x",
    };

    for (const valor of Object.values(scrubSensitiveData(evento))) {
      expect(valor).toBe("[removido]");
    }
  });

  it("mascara telefone solto no meio de um texto livre", () => {
    const evento = {
      mensagem: "Falha ao enviar para (66) 99911-0001 na fila",
    };
    expect(scrubSensitiveData(evento).mensagem).toBe(
      "Falha ao enviar para [telefone] na fila",
    );
  });

  it("mascara telefone sem máscara e com DDI", () => {
    expect(
      scrubSensitiveData({ m: "numero 5566999110001 invalido" }).m,
    ).toContain("[telefone]");
    expect(
      scrubSensitiveData({ m: "numero 66999110001 invalido" }).m,
    ).toContain("[telefone]");
  });

  it("mascara CPF e CNPJ em texto livre", () => {
    expect(scrubSensitiveData({ m: "cpf 123.456.789-00 aqui" }).m).toBe(
      "cpf [cpf] aqui",
    );
    expect(scrubSensitiveData({ m: "cnpj 12.345.678/0001-90 aqui" }).m).toBe(
      "cnpj [cnpj] aqui",
    );
  });

  it("não deixa dígito escapar em sequência sem máscara", () => {
    // O rótulo pode sair como telefone; o que importa é nada vazar inteiro.
    for (const bruto of ["12345678900", "12345678000190", "66999110001"]) {
      const saida = scrubSensitiveData({ m: `valor ${bruto} fim` }).m;
      expect(saida).not.toContain(bruto);
      expect(saida).toMatch(/\[(telefone|cpf|cnpj)\]/);
    }
  });

  it("percorre objetos aninhados e listas", () => {
    const evento = {
      breadcrumbs: [
        { data: { phone: "66999110001" } },
        { data: { url: "/servicos/prv-joao-silva" } },
      ],
      contexts: { app: { user: { cpf: "111.222.333-44" } } },
    };

    const limpo = scrubSensitiveData(evento);

    expect(limpo.breadcrumbs[0].data.phone).toBe("[removido]");
    expect(limpo.breadcrumbs[1].data.url).toBe("/servicos/prv-joao-silva");
    expect(limpo.contexts.app.user.cpf).toBe("[removido]");
  });

  it("não quebra com null, undefined, número ou booleano", () => {
    const evento = { a: null, b: undefined, c: 42, d: true, e: [] };
    expect(scrubSensitiveData(evento)).toEqual(evento);
  });

  it("ignora maiúsculas no nome do campo", () => {
    expect(scrubSensitiveData({ Telefone: "x", CPF: "y" })).toEqual({
      Telefone: "[removido]",
      CPF: "[removido]",
    });
  });
});

describe("configuração de amostragem", () => {
  it("não amostra 100% em produção, para não estourar a cota", () => {
    expect(TRACES_SAMPLE_RATE).toBeGreaterThan(0);
    expect(TRACES_SAMPLE_RATE).toBeLessThanOrEqual(1);
  });

  it("silencia o ruído de extensão de navegador", () => {
    const comoTexto = IGNORED_ERRORS.map(String).join(" ");
    expect(comoTexto).toContain("ResizeObserver");
    expect(comoTexto).toContain("chrome-extension");
  });
});

/**
 * As bordas de cada expressão, uma a uma.
 *
 * Os testes acima confirmam que o dado não vaza. Estes confirmam *qual*
 * regra pegou — e é isso que impede uma expressão de ser afrouxada sem
 * ninguém notar. Uma borda `(?<!\d)` removida por engano continua
 * mascarando telefone e passa em todos os testes de vazamento, mas começa
 * a picotar identificador numérico no meio e transforma relatório de erro
 * em charada.
 */
describe("bordas das expressões", () => {
  const limpar = (m: string) => scrubSensitiveData({ m }).m;

  it("CNPJ é reconhecido antes de CPF — os 11 primeiros dígitos coincidem", () => {
    // Sem a ordem certa, "12.345.678/0001-90" viraria "[cpf]" + sobra.
    expect(limpar("12345678000190")).toBe("[cnpj]");
    expect(limpar("12.345.678/0001-90")).toBe("[cnpj]");
  });

  it("telefone com DDI e com parênteses sai como telefone", () => {
    expect(limpar("+55 (66) 99911-0001")).toBe("[telefone]");
    expect(limpar("(66) 9991-0001")).toBe("[telefone]");
    expect(limpar("+5566999110001")).toBe("[telefone]");
  });

  it("CPF com máscara sai como cpf", () => {
    expect(limpar("123.456.789-00")).toBe("[cpf]");
  });

  it("não pica número maior no meio", () => {
    /*
     * Um timestamp em milissegundos tem 13 dígitos. Sem as bordas, a regra
     * de 10-11 dígitos comeria um pedaço e deixaria o resto solto —
     * "1756[telefone]" no lugar de um número que era só um horário.
     */
    for (const numero of ["1756132800000", "999999999999999"]) {
      expect(limpar(numero)).toBe(numero);
    }
  });

  it("sequência curta demais não é mascarada", () => {
    // Nove dígitos não são telefone brasileiro nem CPF; mascarar aqui
    // apagaria código de pedido e id numérico sem ganho de privacidade.
    expect(limpar("123456789")).toBe("123456789");
  });

  it("mascara todas as ocorrências, não só a primeira", () => {
    expect(limpar("de 66999110001 para 66999110002")).toBe(
      "de [telefone] para [telefone]",
    );
  });

  it("texto sem número atravessa intacto", () => {
    expect(limpar("falha ao gravar a vaga")).toBe("falha ao gravar a vaga");
  });
});

/*
 * O evento que dava voltas (#273).
 *
 * Em produção, toda transação amostrada terminava em `RangeError: Maximum
 * call stack size exceeded` dentro desta função: o evento de transação
 * carrega, em `sdkProcessingMetadata`, a instância de `Scope` do SDK em que
 * o span nasceu — e ela aponta para si mesma. O SDK descartava a medição e
 * mandava no lugar um erro interno, que não passa pelo `beforeSend` e sai
 * sem máscara nenhuma.
 */
describe("ciclo e estado interno do SDK", () => {
  it("objeto que aponta para si mesmo não estoura a pilha", () => {
    const contexto: Record<string, unknown> = { obs: "ligar 66999110001" };
    contexto.eu = contexto;

    const limpo = scrubSensitiveData({ contexto }) as {
      contexto: Record<string, unknown>;
    };

    expect(limpo.contexto.eu).toBe("[circular]");
    // O resto do objeto continua passando pela máscara.
    expect(limpo.contexto.obs).toBe("ligar [telefone]");
  });

  it("ciclo dentro de lista também para", () => {
    const lista: unknown[] = ["66999110001"];
    lista.push(lista);

    expect(scrubSensitiveData(lista)).toEqual(["[telefone]", "[circular]"]);
  });

  /*
   * Repetição não é ciclo. Guardar tudo que já foi visto, em vez de só o
   * caminho atual, trocaria a segunda aparição por "[circular]" — e se a
   * troca fosse para o valor cru, o telefone sairia na segunda.
   */
  it("o mesmo objeto em dois galhos é mascarado nos dois", () => {
    const contato = { obs: "66999110001" };

    expect(scrubSensitiveData({ a: contato, b: contato })).toEqual({
      a: { obs: "[telefone]" },
      b: { obs: "[telefone]" },
    });
  });

  it("não percorre nem recria o estado interno do SDK", () => {
    // O formato de `tracing/sentrySpan.js`, em `@sentry/core`.
    const escopo: Record<string, unknown> = { _cliente: {} };
    (escopo._cliente as Record<string, unknown>).escopo = escopo;
    const metadata = {
      capturedSpanScope: escopo,
      capturedSpanIsolationScope: escopo,
    };

    const limpo = scrubSensitiveData({
      type: "transaction",
      transaction: "/vagas/:id",
      extra: { telefone: "66999110001" },
      sdkProcessingMetadata: metadata,
    });

    /*
     * A mesma referência, e não uma cópia: o SDK ainda lê esse objeto
     * depois do `beforeSendTransaction` (o contexto de amostragem sai
     * dali), e o apaga antes de enviar — não há o que mascarar.
     */
    expect(limpo.sdkProcessingMetadata).toBe(metadata);
    expect(limpo.sdkProcessingMetadata.capturedSpanScope).toBe(escopo);
    expect(limpo.extra).toEqual({ telefone: "[removido]" });
  });
});

/*
 * Os identificadores de rastreio (#275).
 *
 * Um hexadecimal aleatório tem, com frequência, uma sequência de 10 ou 11
 * dígitos — e a regra de telefone a trocava por `[telefone]`. O Sentry
 * recusa a transação cujo `trace_id` não tem 32 caracteres hexadecimais:
 * depois da #273, 2 de cada 3 voltavam como `invalid_transaction`.
 */
describe("identificadores de rastreio", () => {
  // 19 + 10 dígitos seguidos + 3 = 32 caracteres hexadecimais.
  const TRACE = "71624d67c92d40a1afa1234567890b94";
  // 1 + 11 dígitos seguidos + 4 = 16.
  const SPAN = "a12345678901bcde";

  it("a regra de telefone pegaria estes identificadores", () => {
    // O controle: sem a exceção, os dois seriam picotados.
    expect(scrubSensitiveData({ texto: TRACE }).texto).toContain("[telefone]");
    expect(scrubSensitiveData({ texto: SPAN }).texto).toContain("[telefone]");
  });

  it("uma transação no formato do SDK passa com os identificadores intactos", () => {
    const limpo = scrubSensitiveData({
      event_id: "0123456789a0123456789b0123456789",
      contexts: {
        trace: {
          trace_id: TRACE,
          span_id: SPAN,
          data: { "sentry.previous_trace": `${TRACE}-${SPAN}-1` },
          links: [{ trace_id: TRACE, span_id: SPAN }],
        },
      },
      spans: [
        {
          trace_id: TRACE,
          span_id: SPAN,
          parent_span_id: SPAN,
          description: "ligar 66999110001",
        },
      ],
      // Como o SDK liga um fetch ao span em que ele aconteceu.
      breadcrumbs: [{ category: "fetch", data: { __span: SPAN } }],
    });

    expect(limpo.event_id).toBe("0123456789a0123456789b0123456789");
    expect(limpo.contexts.trace.trace_id).toBe(TRACE);
    expect(limpo.contexts.trace.span_id).toBe(SPAN);
    expect(limpo.contexts.trace.data["sentry.previous_trace"]).toBe(
      `${TRACE}-${SPAN}-1`,
    );
    expect(limpo.contexts.trace.links[0]).toEqual({
      trace_id: TRACE,
      span_id: SPAN,
    });
    expect(limpo.spans[0].trace_id).toBe(TRACE);
    expect(limpo.spans[0].parent_span_id).toBe(SPAN);
    expect(limpo.breadcrumbs[0].data.__span).toBe(SPAN);
    // O resto do mesmo evento continua passando pela máscara.
    expect(limpo.spans[0].description).toBe("ligar [telefone]");
  });

  /*
   * A exceção é do valor que o SDK gera, não do nome do campo. Um texto
   * numa chave chamada `trace_id` é só texto, e continua mascarado.
   */
  it("chave de identificador com valor que não é hexadecimal é mascarada", () => {
    expect(scrubSensitiveData({ trace_id: "ligar 66999110001" }).trace_id).toBe(
      "ligar [telefone]",
    );
    expect(scrubSensitiveData({ span_id: "123.456.789-09" }).span_id).toBe(
      "[cpf]",
    );
  });

  /*
   * O release é o hash do commit do deploy (#277). O de 23/09 começava com
   * 14 dígitos, e a regra de CNPJ o trocava por "[cnpj]d995dd…": a
   * transação era aceita, mas perdia a ligação com a versão.
   */
  it("o release com hash de commit passa intacto", () => {
    const SHA = "50799703251002d995dd63da76b9683f0001da52";
    expect(scrubSensitiveData({ texto: SHA }).texto).toContain("[cnpj]");
    expect(scrubSensitiveData({ release: SHA }).release).toBe(SHA);
  });

  it("release que não é hash continua mascarado", () => {
    expect(scrubSensitiveData({ release: "v1 66999110001" }).release).toBe(
      "v1 [telefone]",
    );
  });

  it("hexadecimal fora de uma chave de identificador continua mascarado", () => {
    expect(scrubSensitiveData({ obs: TRACE }).obs).toContain("[telefone]");
  });
});
