/**
 * Descobre o papel de uma chave do Supabase sem falar com a rede.
 *
 * Existe porque a chave anônima colada no lugar da de serviço falha lá na
 * frente, no banco, como `new row violates row-level security policy for
 * table "usuarios"`. A mensagem descreve o sintoma e aponta para o lugar
 * errado: quem lê vai conferir policies e schema, e nada disso está
 * quebrado — o RLS negando a chave anônima é o comportamento projetado.
 *
 * A troca é fácil de cometer: no painel do Supabase a chave `anon` fica
 * visível e a `service_role` fica atrás de um botão *Reveal*.
 *
 * O papel está dentro da própria chave, então dá para conferir na
 * inicialização e falhar dizendo o que de fato está errado.
 */

export type PapelDaChave = "anon" | "service_role" | "desconhecido";

/**
 * Formato JWT (`eyJ...`): o papel está no claim `role` do payload.
 * Formato novo (`sb_secret_` / `sb_publishable_`): está no prefixo.
 */
export function papelDaChave(chave: string): PapelDaChave {
  const limpa = chave.trim();
  if (!limpa) return "desconhecido";

  if (limpa.startsWith("sb_secret_")) return "service_role";
  if (limpa.startsWith("sb_publishable_")) return "anon";

  const partes = limpa.split(".");
  if (partes.length !== 3) return "desconhecido";

  try {
    // base64url, que é o que JWT usa — `-` e `_` no lugar de `+` e `/`.
    const payload = Buffer.from(partes[1], "base64url").toString("utf8");
    const papel = (JSON.parse(payload) as { role?: unknown }).role;
    if (papel === "anon" || papel === "service_role") return papel;
  } catch {
    // Chave que não decodifica não é motivo para derrubar nada aqui: quem
    // decide o que fazer com "desconhecido" é quem chamou.
  }

  return "desconhecido";
}

/**
 * Mensagem para quando a chave de serviço não é de serviço.
 *
 * `desconhecido` não é tratado como erro: chave de formato futuro que
 * funcione não deve impedir o app de subir. O que se recusa é a certeza
 * de estar errado.
 */
export function erroDeChaveDeServico(chave: string): string | null {
  if (papelDaChave(chave) !== "anon") return null;

  return (
    "SUPABASE_SERVICE_ROLE_KEY contém a chave anônima, não a de serviço. " +
    "No painel do Supabase (Project Settings → API) a chave `anon` fica " +
    "visível e a `service_role` fica atrás do botão Reveal. Sem a de " +
    "serviço, escrever em `usuarios` falha como violação de RLS."
  );
}
