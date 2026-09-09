"use client";

import { CalendarX, Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { cancelarRenovacaoMensal } from "./actions";

/**
 * Desliga a renovação automática, sem devolver nada (#170).
 *
 * É o botão que faz a recorrência ser produto e não armadilha: quem
 * autorizou uma cobrança mensal precisa poder desautorizá-la aqui, e não
 * indo procurar o Mercado Pago, onde ela não escolheu ter conta.
 *
 * A confirmação é um segundo clique, e não um `confirm()` do navegador —
 * mesmo padrão da devolução. E o texto diz a coisa que a pessoa mais
 * precisa saber neste momento: **os dias já pagos continuam valendo**.
 * Sem isso, "cancelar" lê como "perco tudo agora", e quem só queria
 * parar de pagar no mês que vem desiste de clicar.
 */
export function CancelarRenovacaoButton({ validaAte }: { validaAte: string }) {
  const [pendente, comTransicao] = useTransition();
  const [confirmando, setConfirmando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  if (!confirmando) {
    return (
      <div className="mt-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setConfirmando(true)}
        >
          <CalendarX size={14} />
          Cancelar renovação
        </Button>
        <p className="mt-1.5 text-[11px] leading-relaxed text-faint">
          Você para de ser cobrado, e continua na busca até o fim do período já
          pago.
        </p>
        {erro && <p className="mt-1.5 text-[11px] text-danger">{erro}</p>}
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-xl border border-warn/30 bg-warn/8 p-3">
      <p className="text-sm leading-relaxed">
        Nada é cobrado de novo, e nada é devolvido: seu perfil continua na busca
        até <strong>{validaAte}</strong>. Depois dessa data ele sai, e você pode
        assinar outra vez quando quiser.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="danger"
          size="sm"
          disabled={pendente}
          onClick={() => {
            setErro(null);
            comTransicao(async () => {
              const resposta = await cancelarRenovacaoMensal({});
              if (!resposta.ok) {
                setErro(resposta.mensagem);
                setConfirmando(false);
              }
            });
          }}
        >
          {pendente ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <CalendarX size={14} />
          )}
          Confirmar cancelamento
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pendente}
          onClick={() => setConfirmando(false)}
        >
          Voltar
        </Button>
      </div>
    </div>
  );
}
