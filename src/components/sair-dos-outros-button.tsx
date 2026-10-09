"use client";

import { Check, MonitorSmartphone } from "lucide-react";
import { useState, useTransition } from "react";
import { sairDosOutrosAparelhosAction } from "@/app/conta/actions";
import { Button } from "@/components/ui/button";

/**
 * Corta as sessões dos outros aparelhos e mantém este (#402).
 *
 * Sem confirmação antes do clique: o efeito não apaga nada e não custa
 * nada a quem clicou, que continua dentro. O que a frase depois do clique
 * precisa dizer é o que aconteceu, e quanto demora — o corte é lido de um
 * cache de até um minuto (#225).
 */
export function SairDosOutrosButton() {
  const [pendente, iniciar] = useTransition();
  const [resultado, setResultado] = useState<"ok" | "erro" | null>(null);

  if (resultado === "ok") {
    return (
      <p
        role="status"
        className="flex items-start gap-2 text-sm leading-relaxed text-muted"
      >
        <Check size={16} className="mt-0.5 flex-none text-vagas" />
        Os outros aparelhos saem da sua conta em até um minuto. Este continua
        dentro.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pendente}
        onClick={() =>
          iniciar(async () => {
            const resposta = await sairDosOutrosAparelhosAction({});
            setResultado(resposta.ok ? "ok" : "erro");
          })
        }
      >
        <MonitorSmartphone size={15} />
        Sair dos outros aparelhos
      </Button>
      {resultado === "erro" && (
        <p role="alert" className="text-danger text-sm">
          Não deu para sair dos outros aparelhos agora. Tente de novo em
          instantes.
        </p>
      )}
    </div>
  );
}
