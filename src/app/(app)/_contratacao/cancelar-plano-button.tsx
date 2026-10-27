"use client";

import { CalendarX, Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { cancelarPlano } from "./creditos-actions";

/**
 * Desliga a renovação do plano de vagas (#489).
 *
 * É o botão que faz a recorrência ser produto e não armadilha — a mesma
 * razão do cancelamento da mensalidade de prestador (#170): quem autorizou
 * uma cobrança mensal precisa poder desautorizá-la aqui, e não procurando o
 * Mercado Pago, onde não escolheu ter conta. É também o primeiro passo de
 * quem quer trocar de plano.
 *
 * A confirmação é um segundo clique, e a frase diz o que acontece com os
 * dias já pagos: o plano segue valendo até o fim do período, e nada é
 * devolvido.
 */
export function CancelarPlanoButton({ validaAte }: { validaAte: string }) {
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
        <p className="mt-1.5 text-xs text-faint leading-relaxed">
          Para trocar de plano, cancele a renovação do atual e assine o novo.
        </p>
        {erro && <p className="mt-1.5 text-xs text-danger">{erro}</p>}
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-xl border border-warn/30 bg-warn/8 p-3">
      <p className="text-sm leading-relaxed">
        Nada é cobrado de novo, e nada é devolvido: seu plano continua valendo
        até <strong>{validaAte}</strong>. Depois dessa data as vagas que
        estiverem no ar seguem até o fim dos 30 dias delas, e você assina outro
        plano quando quiser.
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
              const resposta = await cancelarPlano({});
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
