/**
 * A página da vaga para quem não tem conta (#490).
 *
 * O que se prova é o que o anônimo vê e **o que não vê**: cargo, empresa, local
 * e salário aparecem; telefone, e-mail, WhatsApp e as redes da empresa não;
 * "Candidatar-se" vira entrar ou criar conta e volta para a mesma vaga; vaga
 * encerrada diz que não recebe mais candidaturas e dá o caminho das vagas da
 * cidade; e o dono — e só ele — vê o compartilhar.
 */
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { JobListing } from "@/lib/types";

const estado = vi.hoisted(() => ({
  sessao: null as { usuarioId: string; papel: string } | null,
  vaga: null as unknown,
  userAgent: "Mozilla/5.0 (iPhone) Safari",
  contadas: [] as string[],
}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "user-agent": estado.userAgent }),
}));
vi.mock("next/server", () => ({
  after: (fn: () => unknown) => {
    void fn();
  },
}));
vi.mock("@/server/auth/cookies", () => ({
  sessaoAtual: async () => estado.sessao,
}));
vi.mock("@/server/visualizacoes", () => ({
  contarVisualizacao: async (id: string) => {
    estado.contadas.push(id);
  },
}));
vi.mock("@/lib/data", () => ({
  getJobById: async () => estado.vaga,
  getRelatedJobs: async () => [],
  empresaDoPainel: (usuarioId: string) => usuarioId,
}));
vi.mock("@/app/(app)/vagas/[id]/actions", () => ({
  candidatarSe: async () => ({ ok: true }),
}));
vi.mock("@/app/denuncias/actions", () => ({
  denunciarComEstado: async () => ({}),
}));

const { default: Pagina, generateMetadata } = await import(
  "@/app/(app)/vagas/[id]/page"
);

const emDias = (dias: number) =>
  new Date(Date.now() + dias * 24 * 60 * 60 * 1000).toISOString();

const VAGA = {
  id: "vaga-1",
  company_id: "empresa-1",
  title: "Operador de Máquinas",
  description: "Operação de colheitadeira e manutenção básica de rotina.",
  category: "Agronegócio",
  city: "Sinop - MT",
  neighborhood: "Centro",
  address: "Av. das Itaúbas, 1200",
  contract_type: "CLT",
  work_mode: "presencial",
  for_pcd: false,
  salary_min: 2200,
  salary_max: 2800,
  status: "aberta",
  created_at: new Date().toISOString(),
  expires_at: emDias(20),
  applicant_count: 3,
  company: {
    company_name: "Agro Norte",
    logo_url: null,
    site: "https://agronorte.exemplo",
    instagram: "https://instagram.com/agronorte",
    facebook: "https://facebook.com/agronorte",
    doc_verified: true,
    pessoa_fisica: false,
  },
} as unknown as JobListing;

const parametros = Promise.resolve({ id: "vaga-1" });

async function abrir() {
  render(await Pagina({ params: parametros }));
}

describe("página da vaga sem conta", () => {
  beforeEach(() => {
    estado.sessao = null;
    estado.vaga = VAGA;
    estado.userAgent = "Mozilla/5.0 (iPhone) Safari";
    estado.contadas = [];
  });

  it("mostra cargo, empresa, local, salário e endereço", async () => {
    await abrir();

    expect(
      screen.getByRole("heading", { name: "Operador de Máquinas" }),
    ).toBeTruthy();
    expect(screen.getByText("Agro Norte")).toBeTruthy();
    expect(screen.getByText("Centro, Sinop - MT")).toBeTruthy();
    expect(screen.getByText(/2\.200/)).toBeTruthy();
    expect(screen.getByText("Av. das Itaúbas, 1200")).toBeTruthy();
  });

  /**
   * O critério central: a vaga é pública, o contato não. Telefone, e-mail e
   * WhatsApp nunca estiveram nesta página — e as redes da empresa, que são
   * contato, só aparecem com sessão.
   */
  it("não mostra contato nenhum: nem WhatsApp, nem telefone, nem e-mail, nem redes", async () => {
    await abrir();

    const links = [...document.querySelectorAll("a")].map((a) =>
      a.getAttribute("href"),
    );
    expect(links.filter((h) => /wa\.me|^tel:|^mailto:/.test(h ?? ""))).toEqual(
      [],
    );
    expect(links.filter((h) => /agronorte/.test(h ?? ""))).toEqual([]);
    expect(screen.queryByText("Site")).toBeNull();
    expect(screen.queryByText("Instagram")).toBeNull();
    expect(screen.queryByText("Facebook")).toBeNull();
  });

  it("candidatar-se vira entrar ou criar conta, e os dois voltam para a mesma vaga", async () => {
    await abrir();

    expect(screen.queryByRole("button", { name: /candidatar-se/i })).toBeNull();
    expect(
      screen.getByRole("link", { name: /entrar para se candidatar/i }),
    ).toHaveAttribute("href", "/entrar?destino=%2Fvagas%2Fvaga-1");
    expect(
      screen.getByRole("link", { name: /criar conta grátis/i }),
    ).toHaveAttribute(
      "href",
      "/cadastro?tipo=candidato_clt&destino=%2Fvagas%2Fvaga-1",
    );
  });

  /**
   * "Voltar para vagas" levaria à lista, que continua fechada: quem não tem
   * conta cairia no login.
   */
  it("o voltar leva para a home, não para a lista fechada", async () => {
    await abrir();

    expect(
      screen.getByRole("link", { name: /conhecer a lupa/i }),
    ).toHaveAttribute("href", "/");
    expect(
      screen.queryByRole("link", { name: /voltar para vagas/i }),
    ).toBeNull();
  });

  it("não oferece denunciar nem compartilhar", async () => {
    await abrir();

    expect(screen.queryByRole("button", { name: /denunciar/i })).toBeNull();
    expect(screen.queryByText(/divulgue esta vaga/i)).toBeNull();
  });

  describe("vaga que não está mais aberta", () => {
    it.each([
      ["encerrada", { status: "fechada" }],
      ["vencida", { expires_at: emDias(-2) }],
    ])(
      "%s diz que não recebe candidaturas e dá o caminho da cidade",
      async (_caso, mudanca) => {
        estado.vaga = { ...VAGA, ...mudanca };
        await abrir();

        expect(
          screen.getByText(/não está mais recebendo candidaturas/i),
        ).toBeTruthy();
        expect(
          screen.getByRole("link", { name: /ver vagas em sinop - mt/i }),
        ).toHaveAttribute("href", "/vagas?cidade=Sinop%20-%20MT");
        // Sem convite para entrar por uma vaga que já fechou.
        expect(
          screen.queryByRole("link", { name: /entrar para se candidatar/i }),
        ).toBeNull();
      },
    );
  });

  describe("visualizações", () => {
    it("a visita de uma pessoa conta", async () => {
      await abrir();
      expect(estado.contadas).toEqual(["vaga-1"]);
    });

    /**
     * Colar o link numa conversa manda um servidor buscar a página: contar
     * isso faria o número da empresa subir quando ela divulga.
     */
    it("o robô da prévia do WhatsApp não conta", async () => {
      estado.userAgent = "WhatsApp/2.23.20.0 A";
      await abrir();
      expect(estado.contadas).toEqual([]);
    });
  });
});

describe("página da vaga para quem tem conta", () => {
  beforeEach(() => {
    estado.vaga = VAGA;
    estado.userAgent = "Mozilla/5.0 (iPhone) Safari";
    estado.contadas = [];
  });

  it("candidato vê as redes da empresa e o botão de candidatar-se", async () => {
    estado.sessao = { usuarioId: "candidato-1", papel: "candidato_clt" };
    await abrir();

    expect(screen.getByText("Instagram")).toBeTruthy();
    expect(screen.getByRole("button", { name: /candidatar-se/i })).toBeTruthy();
    expect(
      screen.queryByRole("link", { name: /entrar para se candidatar/i }),
    ).toBeNull();
    expect(
      screen.getByRole("link", { name: /voltar para vagas/i }),
    ).toHaveAttribute("href", "/vagas");
  });

  it("a empresa dona vê o compartilhar", async () => {
    estado.sessao = { usuarioId: "empresa-1", papel: "empresa" };
    await abrir();

    expect(screen.getByText(/divulgue esta vaga/i)).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /enviar no whatsapp/i }),
    ).toBeTruthy();
  });

  it("outra empresa não vê o compartilhar de uma vaga que não é dela", async () => {
    estado.sessao = { usuarioId: "empresa-2", papel: "empresa" };
    await abrir();

    expect(screen.queryByText(/divulgue esta vaga/i)).toBeNull();
  });

  it("vaga encerrada não oferece compartilhar nem a quem a publicou", async () => {
    estado.vaga = { ...VAGA, status: "fechada" };
    estado.sessao = { usuarioId: "empresa-1", papel: "empresa" };
    await abrir();

    expect(screen.queryByText(/divulgue esta vaga/i)).toBeNull();
  });

  it("a visita do próprio dono não conta", async () => {
    estado.sessao = { usuarioId: "empresa-1", papel: "empresa" };
    await abrir();

    expect(estado.contadas).toEqual([]);
  });
});

describe("prévia do link", () => {
  beforeEach(() => {
    estado.vaga = VAGA;
  });

  it("título e descrição levam cargo, empresa, cidade e salário", async () => {
    const meta = await generateMetadata({ params: parametros });

    expect(meta.title).toBe("Operador de Máquinas — Agro Norte");
    expect(String(meta.description)).toContain("Agro Norte · Sinop - MT");
    expect(String(meta.description)).toContain("2.200");
    expect(meta.openGraph).toMatchObject({
      title: "Operador de Máquinas — Agro Norte",
      siteName: "Lupa",
      locale: "pt_BR",
    });
  });

  it("a prévia não carrega contato nem redes", async () => {
    const meta = await generateMetadata({ params: parametros });

    expect(JSON.stringify(meta)).not.toMatch(
      /agronorte|instagram|facebook|wa\.me|@/i,
    );
  });

  it("vaga aberta pode ser indexada; encerrada ou vencida não", async () => {
    expect(
      (await generateMetadata({ params: parametros })).robots,
    ).toBeUndefined();

    estado.vaga = { ...VAGA, status: "fechada" };
    expect((await generateMetadata({ params: parametros })).robots).toEqual({
      index: false,
      follow: false,
    });

    estado.vaga = { ...VAGA, expires_at: emDias(-1) };
    expect((await generateMetadata({ params: parametros })).robots).toEqual({
      index: false,
      follow: false,
    });
  });

  it("vaga que não existe diz isso no título", async () => {
    estado.vaga = null;
    const meta = await generateMetadata({ params: parametros });
    expect(meta.title).toBe("Vaga não encontrada");
  });
});
