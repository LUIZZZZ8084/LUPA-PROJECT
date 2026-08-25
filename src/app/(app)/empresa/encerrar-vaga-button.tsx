"use client";

import { Loader2, XCircle } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { encerrarVaga } from "./actions";

export function EncerrarVagaButton({
  id,
  titulo,
}: {
  id: string;
  titulo: string;
}) {
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1.5">
      <Button
        type="button"
        variant="danger"
        size="sm"
        disabled={pending}
        onClick={() => {
          if (
            !window.confirm(
              `Encerrar "${titulo}"? A vaga some da busca pública, mas os currículos já recebidos continuam aqui.`,
            )
          ) {
            return;
          }
          setErro(null);
          startTransition(async () => {
            const resposta = await encerrarVaga({ id });
            if (!resposta.ok) setErro(resposta.mensagem);
          });
        }}
      >
        {pending ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <XCircle size={14} />
        )}
        Encerrar
      </Button>
      {erro && <p className="text-[11px] text-danger">{erro}</p>}
    </div>
  );
}
