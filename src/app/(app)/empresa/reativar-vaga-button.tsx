"use client";

import { Loader2, RotateCcw } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { reativarVaga } from "./actions";

export function ReativarVagaButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1.5">
      <Button
        type="button"
        variant="empresas"
        size="sm"
        disabled={pending}
        onClick={() => {
          setErro(null);
          startTransition(async () => {
            const resposta = await reativarVaga({ id });
            if (!resposta.ok) setErro(resposta.mensagem);
          });
        }}
      >
        {pending ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <RotateCcw size={14} />
        )}
        Reativar
      </Button>
      {erro && <p className="text-[11px] text-danger">{erro}</p>}
    </div>
  );
}
