"use client";

import { Loader2, Undo2 } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { estornarMensalidade } from "./actions";

/**
 * Pedir o dinheiro de volta, sem sair da Lupa (#168).
 *
 * Só aparece quando existe cobrança aprovada dentro dos sete dias — quem
 * decide isso é a página, no servidor. Mostrar o botão fora do prazo e
 * recusar depois do clique é a armadilha do "botão que só recusa depois
 * do clique" que este projeto já registra.
 *
 * A confirmação é um segundo clique, e não um `confirm()` do navegador:
 * devolver o dinheiro tira a mensalidade na hora, e um clique sem aviso
 * faria alguém perder a vitrine por engano.
 */
export function EstornarButton() {
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
          <Undo2 size={14} />
          Pedir devolução
        </Button>
        <p className="mt-1.5 text-[11px] leading-relaxed text-faint">
          Até sete dias depois do pagamento, o valor volta integral.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-xl border border-warn/30 bg-warn/8 p-3">
      <p className="text-sm leading-relaxed">
        O valor volta integral, e a mensalidade cai na hora — seu perfil sai da
        busca de quem procura profissional. Os seus dados ficam salvos, e você
        pode assinar de novo quando quiser.
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
              const resposta = await estornarMensalidade({});
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
            <Undo2 size={14} />
          )}
          Confirmar devolução
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

      {erro && <p className="mt-2 text-[11px] text-danger">{erro}</p>}
    </div>
  );
}
