"use client";

import { Loader2, ShoppingCart } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { comprarCreditos } from "./creditos-actions";

export function ComprarButton({
  tipo,
  rotulo,
  destaque,
  compacto = false,
  ariaLabel,
}: {
  tipo: string;
  rotulo: string;
  destaque: boolean;
  /** Botão do tamanho do texto, sem margem — para caber numa linha de lista. */
  compacto?: boolean;
  /** Nome acessível quando o rótulo visível se repete ("Comprar" três vezes). */
  ariaLabel?: string;
}) {
  const [pendente, comTransicao] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  return (
    <div className={compacto ? "flex-none" : "mt-4"}>
      <Button
        type="button"
        variant={destaque ? "empresas" : "outline"}
        size="sm"
        className={compacto ? undefined : "w-full"}
        aria-label={ariaLabel}
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
