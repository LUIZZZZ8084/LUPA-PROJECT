import type { MetadataRoute } from "next";
import { urlPublica } from "@/server/url-publica";

/**
 * A home é a única rota pública; o resto é login (#241).
 *
 * Rastrear `/vagas`, `/perfil` etc. sem sessão só bate num redirecionamento
 * para `/entrar` — crawl budget gasto sem página nenhuma para indexar do
 * outro lado. `disallow` explícito é mais barato de manter certo do que
 * confiar que o crawler vai desistir sozinho depois de alguns 307.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/entrar",
        "/cadastro",
        "/esqueci-senha",
        "/redefinir-senha",
        "/verificar-email",
        "/vagas",
        "/servicos",
        "/perfil",
        "/empresa",
        "/contratar",
        "/candidatos",
        "/admin",
        "/pagamento",
        "/api/",
      ],
    },
    sitemap: `${urlPublica()}/sitemap.xml`,
  };
}
