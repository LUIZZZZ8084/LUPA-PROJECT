"use client";

import { Check, Loader2, Send } from "lucide-react";
import { useState, useTransition } from "react";
import { candidatarSe } from "@/app/(app)/vagas/[id]/actions";
import { Button } from "@/components/ui/button";

export function ApplyButton({ jobId }: { jobId: string }) {
  const [pending, startTransition] = useTransition();
  const [applied, setApplied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await candidatarSe({ vagaId: jobId });
      if (result.ok) setApplied(true);
      else setError(result.mensagem);
    });
  }

  if (applied) {
    return (
      <div className="space-y-2">
        <Button variant="outline" size="lg" block disabled>
          <Check size={18} className="text-vagas" />
          Candidatura enviada
        </Button>
        <p className="text-center text-xs text-muted">
          A empresa recebe seu perfil e currículo. Você acompanha o status em
          &ldquo;Minhas candidaturas&rdquo;.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Button
        variant="vagas"
        size="lg"
        block
        onClick={submit}
        disabled={pending}
      >
        {pending ? (
          <Loader2 size={18} className="animate-spin" />
        ) : (
          <Send size={17} />
        )}
        Candidatar-se
      </Button>
      {error && <p className="text-center text-xs text-danger">{error}</p>}
    </div>
  );
}
