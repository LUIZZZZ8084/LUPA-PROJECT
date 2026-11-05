import type { MetadataRoute } from "next";
import { urlPublica } from "@/server/url-publica";

/**
 * A home (#241) e a página para empresas (#537).
 *
 * São as rotas públicas de navegação que valem ser achadas — o resto do app
 * continua atrás do login, e listar uma URL que só redireciona não ajuda
 * indexação nenhuma: é crawl budget gasto num 307. A vaga individual também
 * abre sem sessão (#490), mas vence em 30 dias, e não entra aqui.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: urlPublica(),
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${urlPublica()}/para-empresas`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
  ];
}
