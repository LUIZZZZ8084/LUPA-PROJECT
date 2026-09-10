"use client";

import { Loader2, ShoppingCart } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { comprarCreditos } from "./actions";

export function ComprarButton({
  tipo,
  rotulo,
  destaque,
}: {
  tipo: string;
  rotulo: string;
  destaque: boolean;
}) {
  const [pendente, comTransicao] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  return (
    <div className="mt-4">
      <Button
        type="button"
        variant={destaque ? "empresas" : "outline"}
        size="sm"
        className="w-full"
        disabled={pendente}
        onClick={() => {
          setErro(null);
          comTransicao(async () => {
            const resposta = await comprarCreditos({ tipo });
            // Em caso de sucesso a action redireciona, e este código nunca
            // chega a rodar — só sobra aqui quando ela devolve um erro.
            if (!resposta.ok) setErro(resposta.mensagem);
          });
        }}
      >
        {pendente ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <ShoppingCart size={14} />
        )}
        {rotulo}
      </Button>
      {erro && <p className="mt-1.5 text-[11px] text-danger">{erro}</p>}
    </div>
  );
}
