#!/usr/bin/env node
/**
 * Gera o par de chaves VAPID do push (#48).
 *
 * VAPID é o que prova ao serviço de push (Google, Apple, Mozilla) que a
 * mensagem veio da Lupa. Não custa nada e não depende de provedor pago —
 * ao contrário do SMS da #120.
 *
 * **A chave privada é credencial.** Quem a tiver manda notificação em nome
 * da Lupa para qualquer aparelho inscrito. Este script imprime uma vez, no
 * seu terminal, para você colar direto onde vai guardar — a Vercel e o
 * gerenciador de senhas. Não passe por chat, e não versione.
 *
 * Rode uma vez só. Trocar o par depois **invalida todas as inscrições
 * existentes**: os aparelhos continuam inscritos com a chave antiga, e o
 * envio passa a falhar em silêncio até cada pessoa reinscrever.
 *
 *   node scripts/gerar-vapid.mjs
 */
import webpush from "web-push";

const { publicKey, privateKey } = webpush.generateVAPIDKeys();

console.log(`
Chaves VAPID geradas. Guarde AGORA — não dá para recuperar depois.

  1. Na Vercel, em Settings > Environment Variables, adicione as três.
  2. No seu .env.local, o mesmo, para desenvolver.

────────────────────────────────────────────────────────────────────
NEXT_PUBLIC_VAPID_PUBLIC_KEY=${publicKey}

VAPID_PRIVATE_KEY=${privateKey}

VAPID_SUBJECT=mailto:contato@lupapp.com.br
────────────────────────────────────────────────────────────────────

A pública vai para o navegador — é ela que o aparelho usa para se
inscrever, e por isso leva o prefixo NEXT_PUBLIC_.

A privada NUNCA leva esse prefixo. Ela fica só no servidor, como a
SUPABASE_SERVICE_ROLE_KEY — há teste que trava isso.

VAPID_SUBJECT é um contato para o serviço de push avisar se algo der
errado. Troque pelo e-mail que você de fato lê.
`);
