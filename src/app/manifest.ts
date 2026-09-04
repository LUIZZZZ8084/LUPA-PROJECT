import type { MetadataRoute } from "next";

/**
 * PWA: permite "adicionar à tela inicial" sem passar por loja de app.
 * É o formato do V0 — um único código-fonte, sem revisão da Apple/Google.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Lupa — Trabalho e profissionais perto de você",
    short_name: "Lupa",
    description:
      "Vagas de emprego, prestadores de serviço verificados e empresas contratando em Sinop-MT.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    /*
     * Claro é o padrão da plataforma agora — a splash do PWA usa a mesma
     * cor de fundo que a maioria vai ver ao abrir. Quem prefere escuro
     * ainda sente um instante de claro aqui: a splash roda antes de
     * qualquer JS, então não tem como ler a escolha salva.
     */
    background_color: "#f7f8fa",
    theme_color: "#f7f8fa",
    lang: "pt-BR",
    categories: ["business", "productivity"],
    icons: [
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      { name: "Vagas", url: "/vagas" },
      { name: "Serviços", url: "/servicos" },
      { name: "Minha Empresa", url: "/empresa" },
    ],
  };
}
