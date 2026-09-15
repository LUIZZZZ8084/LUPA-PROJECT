import type { MetadataRoute } from "next";
import { urlPublica } from "@/server/url-publica";

/**
 * Só a home entra aqui (#241).
 *
 * É a única rota pública de navegação — o resto do app continua atrás do
 * login, e listar uma URL que só redireciona não ajuda indexação nenhuma:
 * é crawl budget gasto num 307. Quando mais rota se abrir, ela entra aqui
 * junto.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: urlPublica(),
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
  ];
}
