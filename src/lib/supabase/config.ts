import "server-only";

/**
 * Onde o app acha o Supabase — e por que este módulo é `server-only`.
 *
 * Enquanto as variáveis não estiverem no ambiente, o app roda com os dados
 * de demonstração de Sinop (`src/lib/mock-data.ts`). Isso permite abrir e
 * mostrar o produto antes de qualquer infraestrutura existir, e é requisito
 * de negócio, não atalho técnico.
 *
 * ## A chave anônima perdeu o prefixo `NEXT_PUBLIC_` (#221)
 *
 * `NEXT_PUBLIC_` não é convenção de nome: é uma **instrução ao Next** para
 * embutir o valor no JavaScript que vai para o navegador. O nome antigo
 * declarava, portanto, que a chave era publicável.
 *
 * Ela nunca chegou a ser publicada — conferido no bundle de produção, HTML
 * e os onze chunks —, e o motivo é que **nada no cliente usa Supabase**:
 * não existe módulo de cliente de navegador neste projeto, e o Next só
 * embute `NEXT_PUBLIC_*` onde a variável é de fato referenciada.
 *
 * Mas isso era sorte de arranjo, não garantia. Bastava um `"use client"`
 * novo importar `isSupabaseConfigured` — coisa perfeitamente razoável de
 * se fazer — e a chave iria para o bundle **sem nada quebrar e sem nada
 * ficar vermelho**. O `import "server-only"` no topo é o que troca esse
 * silêncio por erro de build.
 *
 * O que a chave alcança, para quem se perguntar se valia o cuidado:
 * `provider_listings` inteira, com telefone de cada prestador, sem login.
 * É pouco hoje (dois prestadores reais) e cresce com o cadastro. E
 * contraria a postura de 21/08/2026, que tirou o app da busca do Google
 * justamente para pôr o dado atrás do login.
 *
 * ## Por que não é o caso de fechar `anon` no banco
 *
 * A tentação seria revogar o acesso de `anon` às views e ler tudo com a
 * chave de serviço. Seria pior: a chave anônima é o **menor privilégio**
 * — ela alcança o que é público e mais nada, e é isso que faz um `select`
 * escrito errado ser um bug em vez de um vazamento. Trocá-la pela de
 * serviço dá privilégio total a toda leitura do app.
 *
 * ## A URL continua pública, e pode
 *
 * `NEXT_PUBLIC_SUPABASE_URL` é um hostname. `next.config.ts` precisa dele
 * em tempo de build para liberar o otimizador de imagem
 * (`src/lib/imagens.ts`), e conhecer o endereço não dá acesso a nada.
 */

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

/**
 * A chave anônima, pelo nome novo — com o antigo ainda aceito.
 *
 * O fallback existe por uma razão só, e ela é temporária: derrubar
 * produção por causa de um nome de variável seria trocar um risco
 * hipotético por uma indisponibilidade real. Enquanto só o nome antigo
 * estiver na Vercel, o app sobe normalmente e
 * `conferirConfiguracaoDeProducao` avisa no log.
 *
 * Quando `SUPABASE_ANON_KEY` existir em produção e o nome antigo for
 * apagado, esta segunda metade sai — e o teste que cobra o aviso sai
 * junto.
 */
export const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "";

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
