"use client";

import { CreditCard, Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { assinarMensalidade } from "./actions";

export function AssinarButton({ renovar }: { renovar: boolean }) {
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  return (
    <div className="mt-4">
      <Button
        type="button"
        variant="servicos"
        size="sm"
        disabled={pending}
        onClick={() => {
          setErro(null);
          startTransition(async () => {
            const resposta = await assinarMensalidade({});
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
        {renovar ? "Renovar mensalidade" : "Assinar"}
      </Button>
      {erro && <p className="mt-1.5 text-[11px] text-danger">{erro}</p>}
    </div>
  );
}
