/**
 * A página de erro que o `data.ts` prometia (#249).
 *
 * `falhaDeConsulta` lança de propósito — "página de erro é honesta; vaga
 * falsa não é" —, e a página honesta não existia: a fronteira era a padrão
 * do Next, preta e em inglês. Estes testes travam o que ela precisa fazer
 * para merecer o nome.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const sentry = vi.hoisted(() => ({ captureException: vi.fn() }));
const observabilidade = vi.hoisted(() => ({ isSentryEnabled: true }));

vi.mock("@sentry/nextjs", () => sentry);
vi.mock("@/lib/observability", () => observabilidade);

const { ErroDaTela } = await import("@/components/erro-da-tela");

function erro(digest?: string) {
  return Object.assign(new Error("falhou"), digest ? { digest } : {});
}

describe("página de erro", () => {
  beforeEach(() => {
    sentry.captureException.mockClear();
    observabilidade.isSentryEnabled = true;
  });

  it("fala português e oferece as duas saídas", () => {
    render(<ErroDaTela error={erro("123")} reset={() => {}} />);

    expect(
      screen.getByRole("heading", { name: /esta tela não abriu/i }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /tentar de novo/i }),
    ).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: /voltar ao início/i })
        .getAttribute("href"),
    ).toBe("/");
  });

  it("tentar de novo chama o reset do Next", () => {
    const reset = vi.fn();
    render(<ErroDaTela error={erro("123")} reset={reset} />);

    fireEvent.click(screen.getByRole("button", { name: /tentar de novo/i }));

    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("mostra o código e o leva no assunto do e-mail ao suporte", () => {
    render(<ErroDaTela error={erro("4172993016")} reset={() => {}} />);

    expect(screen.getByText("4172993016")).toBeTruthy();
    const email = screen.getByRole("link", { name: /suporte@/i });
    /*
     * O código no assunto é o que torna o relato útil: é o `digest` que
     * liga a mensagem da pessoa ao evento no painel. Sem ele, "deu erro"
     * não tem onde ser procurado.
     */
    expect(decodeURIComponent(email.getAttribute("href") ?? "")).toContain(
      "código 4172993016",
    );
  });

  it("não reporta de novo o erro que o servidor já reportou", () => {
    render(<ErroDaTela error={erro("123")} reset={() => {}} />);

    // Com `digest`, o erro nasceu no servidor e `captureRequestError`, no
    // `instrumentation.ts`, já o mandou. Reportar aqui contaria duas vezes.
    expect(sentry.captureException).not.toHaveBeenCalled();
  });

  it("reporta o erro nascido no navegador, que só esta fronteira vê", () => {
    const falha = erro();
    render(<ErroDaTela error={falha} reset={() => {}} />);

    expect(sentry.captureException).toHaveBeenCalledWith(falha);
  });

  it("sem Sentry configurado, não chama nada", () => {
    observabilidade.isSentryEnabled = false;
    render(<ErroDaTela error={erro()} reset={() => {}} />);

    expect(sentry.captureException).not.toHaveBeenCalled();
  });

  it("não afirma que alguém já está vendo o problema", () => {
    const { container } = render(
      <ErroDaTela error={erro("123")} reset={() => {}} />,
    );

    // A regra de `promessas-da-tela` cobra o código-fonte; esta cobra o
    // que de fato renderiza.
    expect(container.textContent).not.toMatch(/já estamos sabendo/i);
  });
});
