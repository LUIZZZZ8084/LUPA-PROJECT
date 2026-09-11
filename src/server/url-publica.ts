/**
 * A URL pública do app: a raiz de todo link que sai daqui para fora.
 *
 * São dois usos, e os dois deixam o processo: o `notification_url` e os
 * `back_urls` que o Mercado Pago recebe ao criar uma cobrança, e o link de
 * trocar senha que vai por e-mail. Nenhum dos dois é link que alguém clica
 * dentro do app — são endereços que **outro sistema** vai usar para voltar
 * até aqui, e por isso não dá para derivá-los do pedido em curso.
 *
 * **Em produção não se adivinha.** Era o que acontecia: sem
 * `NEXT_PUBLIC_APP_URL`, isto caía em `VERCEL_URL`, que **nunca é o
 * domínio próprio** — é a URL gerada do deploy
 * (`lupa-project-<hash>.vercel.app`), e ela muda a cada publicação.
 *
 * O preço apareceu em 10/09/2026, na primeira venda de verdade da Lupa:
 * R$ 29,90 aprovados no Mercado Pago e **nenhum aviso**, porque a
 * notificação saiu para um hostname que não era o nosso. O dinheiro
 * entrou, a cobrança ficou `pendente` para sempre, quem pagou não recebeu
 * a vaga — e nada disso apareceu em lugar nenhum até alguém ir conferir à
 * mão, um dia depois ([#195]).
 *
 * Por isso o modo de falha inverteu: falta de configuração agora derruba a
 * produção, como já acontece com `SESSION_SECRET`. Deploy vermelho é
 * barulhento e custa uma linha na Vercel; o que havia antes era silêncio
 * com gente pagando.
 *
 * [#195]: https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/195
 */
export function urlPublica(): string {
  const configurada = process.env.NEXT_PUBLIC_APP_URL?.trim();
  /*
   * Barra no fim é erro de digitação provável, e caro: quem escreve
   * `https://lupapp.com.br/` faz o webhook virar `...br//api/webhooks`.
   * Aceitar as duas grafias custa uma linha e evita um deploy perdido.
   */
  if (configurada) return configurada.replace(/\/+$/, "");

  /*
   * `VERCEL_ENV`, e não `NODE_ENV`: a Vercel compila preview com
   * `NODE_ENV=production` também, e o `npm run build` da suíte e2e
   * igual. Recusar por `NODE_ENV` derrubaria os dois — e nenhum dos dois
   * é o site de verdade.
   */
  if (process.env.VERCEL_ENV === "production") {
    throw new Error(
      "NEXT_PUBLIC_APP_URL ausente em produção. É a raiz dos links que o " +
        "Mercado Pago e o e-mail de recuperação usam para voltar ao app; " +
        "sem ela, o aviso de pagamento vai para o endereço errado e a " +
        "cobrança nunca é creditada. Defina https://lupapp.com.br na " +
        "Vercel, em Production, e republique.",
    );
  }

  /*
   * Preview continua deduzindo, e está certo: ali a URL do deploy *é* o
   * endereço onde a pessoa está. Exigir configuração por branch tiraria o
   * único ambiente onde dá para exercitar cobrança sem tocar no domínio
   * real.
   */
  const doDeploy = process.env.VERCEL_URL?.trim();
  if (doDeploy) return `https://${doDeploy}`;

  return "http://localhost:3000";
}
