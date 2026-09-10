"use client";

import { CreditCard, Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { comprarGeradorCurriculo } from "./actions";

export function ComprarGeradorButton() {
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  return (
    <div className="mt-4">
      <Button
        type="button"
        variant="vagas"
        size="sm"
        disabled={pending}
        onClick={() => {
          setErro(null);
          startTransition(async () => {
            const resposta = await comprarGeradorCurriculo({});
            // Em caso de sucesso a action redireciona, e este código nunca
            // chega a rodar — só sobra aqui quando ela devolve um erro.
            if (!resposta.ok) setErro(resposta.mensagem);
          });
        }}
      >
        {pending ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <CreditCard size={14} />
        )}
        Comprar
      </Button>
      {erro && <p className="mt-1.5 text-[11px] text-danger">{erro}</p>}
    </div>
  );
}
