/**
 * Candidatar-se a uma vaga com perguntas de triagem (#491).
 *
 * "Sem responder todas, não envia": o botão que abre as perguntas não envia,
 * o que envia só se habilita com tudo respondido, e nenhuma resposta vem
 * marcada de antemão — "Não" como padrão faria uma pessoa distraída se
 * candidatar dizendo que não tem a CNH que tem.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const candidatarSe = vi.hoisted(() => vi.fn());
vi.mock("@/app/(app)/vagas/[id]/actions", () => ({
  candidatarSe: (...args: unknown[]) => candidatarSe(...args),
}));

import { ApplyButton } from "@/components/apply-button";

const PERGUNTAS = [
  { texto: "Tem CNH E?", eliminatoria: true },
  { texto: "Pode viajar?", eliminatoria: false },
];

beforeEach(() => candidatarSe.mockReset());

function responder(pergunta: string, resposta: "Sim" | "Não") {
  const grupo = screen.getByRole("group", { name: new RegExp(pergunta) });
  const opcao = [...grupo.querySelectorAll("label")].find(
    (l) => l.textContent?.trim() === resposta,
  );
  fireEvent.click(opcao?.querySelector("input") as HTMLInputElement);
}

describe("ApplyButton com perguntas", () => {
  it("vaga sem pergunta se candidata como sempre, num toque", async () => {
    candidatarSe.mockResolvedValue({ ok: true });
    render(<ApplyButton jobId="vaga-1" />);

    fireEvent.click(screen.getByRole("button", { name: "Candidatar-se" }));

    await waitFor(() =>
      expect(candidatarSe).toHaveBeenCalledWith({
        vagaId: "vaga-1",
        respostas: undefined,
      }),
    );
  });

  it("o primeiro toque abre as perguntas, e não envia nada", () => {
    render(<ApplyButton jobId="vaga-1" perguntas={PERGUNTAS} />);
    expect(screen.queryByText("Tem CNH E?")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Candidatar-se" }));

    expect(candidatarSe).not.toHaveBeenCalled();
    expect(screen.getByText(/Tem CNH E\?/)).toBeTruthy();
    expect(screen.getByText(/Pode viajar\?/)).toBeTruthy();
  });

  it("nenhuma resposta vem marcada, e o envio fica desabilitado", () => {
    render(<ApplyButton jobId="vaga-1" perguntas={PERGUNTAS} />);
    fireEvent.click(screen.getByRole("button", { name: "Candidatar-se" }));

    for (const radio of screen.getAllByRole("radio")) {
      expect((radio as HTMLInputElement).checked).toBe(false);
    }
    expect(
      screen.getByRole("button", { name: "Enviar candidatura" }),
    ).toBeDisabled();
    expect(screen.getByText("Faltam 2 perguntas para enviar.")).toBeTruthy();
  });

  it("diz quantas faltam, no singular quando é uma", () => {
    render(<ApplyButton jobId="vaga-1" perguntas={PERGUNTAS} />);
    fireEvent.click(screen.getByRole("button", { name: "Candidatar-se" }));

    responder("Tem CNH E", "Sim");

    expect(
      screen.getByText("Falta responder 1 pergunta para enviar."),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Enviar candidatura" }),
    ).toBeDisabled();
  });

  it("com tudo respondido, envia as respostas na ordem das perguntas", async () => {
    candidatarSe.mockResolvedValue({ ok: true });
    render(<ApplyButton jobId="vaga-1" perguntas={PERGUNTAS} />);
    fireEvent.click(screen.getByRole("button", { name: "Candidatar-se" }));

    responder("Tem CNH E", "Não");
    responder("Pode viajar", "Sim");
    const enviar = screen.getByRole("button", { name: "Enviar candidatura" });
    expect(enviar).toBeEnabled();
    fireEvent.click(enviar);

    await waitFor(() =>
      expect(candidatarSe).toHaveBeenCalledWith({
        vagaId: "vaga-1",
        respostas: [false, true],
      }),
    );
    expect(await screen.findByText("Candidatura enviada")).toBeTruthy();
  });

  /**
   * Quem responde Não a uma eliminatória **envia do mesmo jeito**: a tela
   * não barra, e o aviso de que a empresa considera a pergunta indispensável
   * está à vista antes da resposta.
   */
  it("avisa quais perguntas a empresa considera indispensáveis", () => {
    render(<ApplyButton jobId="vaga-1" perguntas={PERGUNTAS} />);
    fireEvent.click(screen.getByRole("button", { name: "Candidatar-se" }));

    const indispensaveis = screen.getAllByText(/indispensável para a vaga/i);
    expect(indispensaveis).toHaveLength(1);
    expect(
      screen.getByRole("group", { name: /Tem CNH E\?/ }).textContent,
    ).toContain("indispensável para a vaga");
  });

  it("a recusa do servidor aparece, e a pessoa pode tentar de novo", async () => {
    candidatarSe.mockResolvedValue({
      ok: false,
      mensagem: "Esta vaga não está mais recebendo candidaturas.",
    });
    render(<ApplyButton jobId="vaga-1" perguntas={PERGUNTAS} />);
    fireEvent.click(screen.getByRole("button", { name: "Candidatar-se" }));
    responder("Tem CNH E", "Sim");
    responder("Pode viajar", "Sim");

    fireEvent.click(screen.getByRole("button", { name: "Enviar candidatura" }));

    expect(
      await screen.findByText(
        "Esta vaga não está mais recebendo candidaturas.",
      ),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Enviar candidatura" }),
    ).toBeEnabled();
  });
});
