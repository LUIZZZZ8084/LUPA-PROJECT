"use client";

import { Check, FileImage, Loader2, X } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { decideVerification, type ReviewDecision } from "./actions";

export function VerificationActions({
  requestId,
  name,
  className,
}: {
  requestId: string;
  name: string;
  className?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [decided, setDecided] = useState<ReviewDecision | null>(null);
  const [error, setError] = useState<string | null>(null);

  function decide(decision: ReviewDecision) {
    setError(null);
    startTransition(async () => {
      const result = await decideVerification(requestId, decision);
      if (result.ok) setDecided(decision);
      else setError(result.error);
    });
  }

  if (decided) {
    return (
      <p
        className={cn(
          "text-xs font-medium",
          decided === "aprovado" ? "text-vagas" : "text-danger",
          className,
        )}
      >
        {decided === "aprovado"
          ? `${name} aprovado — documento excluído do storage.`
          : `${name} reprovado — documento excluído do storage.`}
      </p>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap gap-2">
        {/* URL assinada de curta duração para o bucket privado — gerada
            no servidor quando o Supabase estiver conectado. */}
        <Button type="button" variant="outline" size="sm" disabled>
          <FileImage size={15} />
          Ver documento
        </Button>
        <Button
          type="button"
          variant="vagas"
          size="sm"
          disabled={pending}
          onClick={() => decide("aprovado")}
        >
          {pending ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <Check size={15} />
          )}
          Aprovar
        </Button>
        <Button
          type="button"
          variant="danger"
          size="sm"
          disabled={pending}
          onClick={() => decide("reprovado")}
        >
          <X size={15} />
          Reprovar
        </Button>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
