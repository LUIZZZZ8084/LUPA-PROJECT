import type { MetadataRoute } from "next";
import { urlPublica } from "@/server/url-publica";

/**
 * A home e a vaga individual são públicas; o resto é login (#241, #490).
 *
 * Rastrear `/vagas`, `/perfil` etc. sem sessão só bate num redirecionamento
 * para `/entrar` — crawl budget gasto sem página nenhuma para indexar do
 * outro lado. `disallow` explícito é mais barato de manter certo do que
 * confiar que o crawler vai desistir sozinho depois de alguns 307.
 *
 * **`/vagas` fecha só a lista, e não `/vagas/<id>`** (#490). Bloquear o
 * prefixo inteiro bloqueava também a página da vaga que a empresa compartilha,
 * e o rastreador da prévia do Facebook e do Instagram obedece ao
 * `robots.txt`: o link sairia sem miniatura. `$` e `?` são as extensões do
 * Google e do Bing; os demais tratam como texto e rastreiam a lista, que
 * responde com um redirecionamento para `/entrar`.
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
        "/vagas$",
        "/vagas?",
        "/servicos",
        "/perfil",
        "/empresa",
        "/contratar",
        "/candidatos",
        "/pagamento",
        "/api/",
      ],
    },
    sitemap: `${urlPublica()}/sitemap.xml`,
  };
}
