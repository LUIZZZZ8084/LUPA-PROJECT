import { ConfirmarEmail } from "../perfil/confirmar-email";

/**
 * O pedido de confirmação de e-mail na área de contratação (#560).
 *
 * O aviso de candidatura por e-mail (#543) só vai para e-mail confirmado,
 * porque leva o nome de quem se candidatou. Em 05/11/2026 nenhuma das contas
 * de empresa de produção tinha confirmado, e o aviso não chegava a ninguém:
 * o pedido morava só no Perfil, onde quem contrata quase não vai.
 *
 * Aparece no painel e logo depois de publicar, que é quando a empresa mais
 * quer saber da candidatura. Some sozinho quando ela confirma.
 */
export function ConfirmarParaAvisos({
  verificado,
  className,
}: {
  verificado: boolean;
  className?: string;
}) {
  return (
    <ConfirmarEmail
      verificado={verificado}
      className={className}
      texto={
        <>
          <strong className="text-ink">
            Confirme seu e-mail para saber de cada candidatura.
          </strong>{" "}
          A Lupa avisa por e-mail quando alguém se candidata às suas vagas, mas
          só para e-mail confirmado. O link chega na sua caixa de entrada.
        </>
      }
    />
  );
}
