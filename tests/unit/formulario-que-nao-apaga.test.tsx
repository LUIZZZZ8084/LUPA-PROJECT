/**
 * Quem erra um campo corrige só aquele campo (#291).
 *
 * O React 19 limpa todo `<form action={...}>` depois que a action termina,
 * mesmo quando ela devolve erro. O servidor apontava o CPF errado, e a
 * mensagem chegava num cadastro já em branco: a pessoa preenchia tudo de
 * novo. Relato do Luiz em 25/09/2026.
 *
 * Os testes de comportamento usam um formulário mínimo com o mesmo arranjo
 * das telas (`useActionState`, `action` no `<form>`, `Field` com `error`). O
 * de varredura lê o código-fonte e cobra que todo formulário novo com
 * `useActionState` passe por `useEnvioQueNaoApaga`, ou diga por que não.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useActionState } from "react";
import { describe, expect, it } from "vitest";
import { Field, Input } from "@/components/ui/field";
import { useEnvioQueNaoApaga } from "@/components/ui/formulario";

type Estado = { ok?: boolean; campos?: Record<string, string> };

/** Recusa o CPF enquanto ele não for "123", como o servidor faria. */
async function validar(_: Estado, dados: FormData): Promise<Estado> {
  if (dados.get("cpf") !== "123") return { campos: { cpf: "CPF inválido." } };
  return { ok: true };
}

function Formulario({ limparAoConcluir = false }) {
  const [estado, acao] = useActionState(validar, {});
  const envio = useEnvioQueNaoApaga(acao, estado, { limparAoConcluir });
  return (
    <form action={acao} {...envio}>
      <Field label="CPF" error={estado.campos?.cpf}>
        <Input name="cpf" />
      </Field>
      <Field label="Nome">
        <Input name="nome" />
      </Field>
      <Field label="Senha">
        <Input name="senha" type="password" />
      </Field>
      <button type="submit">Enviar</button>
      {estado.ok && <p>Enviado</p>}
    </form>
  );
}

/** O arranjo de antes da #291: `action` no `<form>` e mais nada. */
function FormularioDesprotegido() {
  const [estado, acao] = useActionState(validar, {});
  return (
    <form action={acao}>
      <Field label="CPF" error={estado.campos?.cpf}>
        <Input name="cpf" />
      </Field>
      <Field label="Nome">
        <Input name="nome" />
      </Field>
      <button type="submit">Enviar</button>
    </form>
  );
}

describe("o formulário guarda o que foi digitado", () => {
  /**
   * Controle: prova que o defeito existe neste ambiente. Sem ele, os testes
   * abaixo passariam também num ambiente onde o React nunca limpasse nada.
   */
  it("sem a proteção, o React apaga tudo depois do erro", async () => {
    const pessoa = userEvent.setup();
    render(<FormularioDesprotegido />);

    await pessoa.type(screen.getByLabelText("CPF"), "999");
    await pessoa.type(screen.getByLabelText("Nome"), "Maria da Silva");
    await pessoa.click(screen.getByRole("button", { name: "Enviar" }));

    expect(await screen.findByText("CPF inválido.")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText("Nome")).toHaveValue(""));
  });

  it("quando um campo dá erro, os outros continuam preenchidos", async () => {
    const pessoa = userEvent.setup();
    render(<Formulario />);

    await pessoa.type(screen.getByLabelText("CPF"), "999");
    await pessoa.type(screen.getByLabelText("Nome"), "Maria da Silva");
    await pessoa.type(screen.getByLabelText("Senha"), "segredo");
    await pessoa.click(screen.getByRole("button", { name: "Enviar" }));

    expect(await screen.findByText("CPF inválido.")).toBeInTheDocument();
    expect(screen.getByLabelText("Nome")).toHaveValue("Maria da Silva");
    expect(screen.getByLabelText("Senha")).toHaveValue("segredo");
    // O campo errado também fica como estava, para corrigir e não redigitar.
    expect(screen.getByLabelText("CPF")).toHaveValue("999");
  });

  it("o cursor vai para o campo que errou, marcado como inválido", async () => {
    const pessoa = userEvent.setup();
    render(<Formulario />);

    await pessoa.type(screen.getByLabelText("CPF"), "999");
    await pessoa.type(screen.getByLabelText("Nome"), "Maria");
    await pessoa.click(screen.getByRole("button", { name: "Enviar" }));

    const cpf = screen.getByLabelText("CPF");
    await waitFor(() => expect(cpf).toHaveFocus());
    expect(cpf).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Nome")).not.toHaveAttribute("aria-invalid");
  });

  it("corrigido o campo, o envio passa", async () => {
    const pessoa = userEvent.setup();
    render(<Formulario />);

    await pessoa.type(screen.getByLabelText("CPF"), "999");
    await pessoa.click(screen.getByRole("button", { name: "Enviar" }));
    await screen.findByText("CPF inválido.");

    await pessoa.clear(screen.getByLabelText("CPF"));
    await pessoa.type(screen.getByLabelText("CPF"), "123");
    await pessoa.click(screen.getByRole("button", { name: "Enviar" }));

    expect(await screen.findByText("Enviado")).toBeInTheDocument();
  });

  /**
   * O formulário que fica na tela para mandar outro (foto nova, mais um
   * trabalho) limpa quando dá certo. Sem isso, o mesmo trabalho sairia
   * publicado duas vezes num segundo clique.
   */
  it("com limparAoConcluir, limpa só quando dá certo", async () => {
    const pessoa = userEvent.setup();
    render(<Formulario limparAoConcluir />);

    await pessoa.type(screen.getByLabelText("CPF"), "999");
    await pessoa.type(screen.getByLabelText("Nome"), "Maria");
    await pessoa.click(screen.getByRole("button", { name: "Enviar" }));
    await screen.findByText("CPF inválido.");
    expect(screen.getByLabelText("Nome")).toHaveValue("Maria");

    await pessoa.clear(screen.getByLabelText("CPF"));
    await pessoa.type(screen.getByLabelText("CPF"), "123");
    await pessoa.click(screen.getByRole("button", { name: "Enviar" }));
    await screen.findByText("Enviado");

    await waitFor(() => expect(screen.getByLabelText("Nome")).toHaveValue(""));
  });
});

/* ============================================================
   Varredura: formulário novo não nasce com o defeito
   ============================================================ */

const RAIZ = process.cwd();

/**
 * Formulários com `useActionState` que não precisam de proteção, e por quê.
 *
 * O número é quantos formulários daquele arquivo ficam de fora. Exceção que
 * deixa de ser usada também reprova, para a lista não envelhecer.
 */
const SEM_PROTECAO: Record<string, { formularios: number; razao: string }> = {
  "src/app/(app)/perfil/confirmar-email.tsx": {
    formularios: 1,
    razao: "Só o botão de reenviar o e-mail. Não há campo para perder.",
  },
  "src/app/(app)/perfil/verificar-cnpj.tsx": {
    formularios: 1,
    razao: "Só o botão de conferir na Receita. Não há campo para perder.",
  },
  "src/app/(app)/perfil/publicacoes/feed.tsx": {
    formularios: 1,
    razao:
      "BotaoDeStatus: remover ou devolver ao feed, com um campo escondido que o próprio React recoloca.",
  },
};

function arquivosTsx(pasta: string): string[] {
  return readdirSync(pasta).flatMap((nome) => {
    const caminho = join(pasta, nome);
    if (statSync(caminho).isDirectory()) return arquivosTsx(caminho);
    return caminho.endsWith(".tsx") ? [caminho] : [];
  });
}

/**
 * Cada `<form ...>` do arquivo, do `<form` até o `>` que fecha a tag.
 *
 * Só conta `<form` no começo da linha: um comentário que cita
 * `<form action={...}>` no meio da frase não é formulário.
 */
function tagsDeFormulario(fonte: string): string[] {
  return [...fonte.matchAll(/^[ \t]*<form\b/gm)].map(({ index }) => {
    // A tag termina no `>` seguido de quebra de linha; `=>` dentro de um
    // atributo nunca é seguido de quebra, porque o formatador põe `{` antes.
    const fim = fonte.indexOf(">\n", index);
    return fonte.slice(index, fim + 1);
  });
}

function semProtecaoPorArquivo(): Record<string, number> {
  const resultado: Record<string, number> = {};
  for (const pasta of ["src/app", "src/components"]) {
    for (const arquivo of arquivosTsx(join(RAIZ, pasta))) {
      const fonte = readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
      // `useActionState(` e também `useActionState<Tipo>(`.
      if (!/useActionState[<(]/.test(fonte)) continue;
      const desprotegidos = tagsDeFormulario(fonte).filter(
        (tag) =>
          tag.includes("action={") &&
          !tag.includes("{...envio}") &&
          !tag.includes("onSubmit="),
      ).length;
      if (desprotegidos > 0) {
        resultado[relative(RAIZ, arquivo).replace(/\\/g, "/")] = desprotegidos;
      }
    }
  }
  return resultado;
}

describe("varredura dos formulários", () => {
  it("a varredura acha os formulários protegidos (controle)", () => {
    // Sem este controle, uma varredura que não achasse nada passaria verde.
    const cadastro = readFileSync(
      join(RAIZ, "src/app/(auth)/cadastro/form.tsx"),
      "utf8",
    ).replace(/\r\n/g, "\n");
    const tags = tagsDeFormulario(cadastro);
    expect(tags).toHaveLength(1);
    expect(tags[0]).toContain("{...envio}");
  });

  it("todo formulário com useActionState guarda o que foi digitado", () => {
    const esperado = Object.fromEntries(
      Object.entries(SEM_PROTECAO).map(([arquivo, { formularios }]) => [
        arquivo,
        formularios,
      ]),
    );
    expect(semProtecaoPorArquivo()).toEqual(esperado);
  });

  it("toda exceção diz por quê", () => {
    for (const { razao } of Object.values(SEM_PROTECAO)) {
      expect(razao.length).toBeGreaterThan(20);
    }
  });
});
