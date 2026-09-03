/**
 * De onde `next/image` pode carregar foto.
 *
 * Mora aqui, e não dentro do `next.config.ts`, por uma razão prática: o
 * arquivo de configuração importa o Sentry, e reimportá-lo a cada caso de
 * teste levava segundos. A regra é pequena e não depende de nada — separá-la
 * a torna testável de graça.
 */

export interface HostDeImagem {
  protocol: "https";
  hostname: string;
}

/**
 * O host do Storage, tirado da variável do próprio projeto.
 *
 * Sem ele em `remotePatterns`, `next/image` recusa a foto e a alternativa é
 * `<img>` — que manda o arquivo no tamanho em que foi enviado. Foto de
 * celular tem alguns megabytes, e o público deste app abre a tela em dado
 * móvel contado: é a diferença entre a grade carregar e a pessoa desistir.
 *
 * Derivado, e não curinga: `**.supabase.co` deixaria o otimizador de imagem
 * servir de proxy para qualquer projeto do Supabase na internet, e cada
 * transformação é cobrada de nós.
 *
 * Lista vazia no modo demonstração, e isso está certo — sem Supabase não há
 * Storage, e nenhuma foto remota aparece na tela.
 */
export function hostsDeImagemRemota(
  url = process.env.NEXT_PUBLIC_SUPABASE_URL,
): HostDeImagem[] {
  if (!url) return [];
  try {
    return [{ protocol: "https", hostname: new URL(url).hostname }];
  } catch {
    /*
     * URL torta no ambiente não pode derrubar o build: o app já cai para o
     * modo demonstração quando a configuração não presta, e o build precisa
     * passar em qualquer máquina.
     */
    return [];
  }
}
