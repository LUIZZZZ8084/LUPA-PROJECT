"use client";

import { Check, FileImage, Loader2, X } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  decideVerification,
  decidirDenunciaAction,
  type ReviewDecision,
} from "./actions";

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

/**
 * Tirar do ar ou descartar o que foi denunciado (#435).
 *
 * "Tirar do ar" pede um segundo clique: encerra uma vaga ou apaga uma
 * avaliação de alguém, e um clique errado não tem volta pela tela.
 * Decidido, o item sai da lista na revalidação do painel — é essa saída
 * que diz que deu certo.
 */
export function DecisaoDeDenuncia({
  alvo,
  alvoId,
  className,
}: {
  alvo: "vaga" | "avaliacao" | "publicacao";
  alvoId: string;
  className?: string;
}) {
  const [pendente, iniciar] = useTransition();
  const [confirmando, setConfirmando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function decidir(tirarDoAr: boolean) {
    setErro(null);
    iniciar(async () => {
      const r = await decidirDenunciaAction({ alvo, alvoId, tirarDoAr });
      if (!r.ok) setErro(r.mensagem);
    });
  }

  const oQue =
    alvo === "vaga"
      ? "a vaga"
      : alvo === "avaliacao"
        ? "a avaliação"
        : "a foto";

  return (
    <div className={cn("space-y-2", className)}>
      {confirmando ? (
        <div className="space-y-2 rounded-xl border border-danger/30 bg-danger/5 p-3">
          <p className="text-sm">
            {alvo === "vaga"
              ? "A vaga é encerrada e sai da busca. A empresa vê a vaga como encerrada no painel."
              : alvo === "avaliacao"
                ? "A avaliação é apagada, e a nota do prestador é recalculada."
                : "A foto é apagada de vez, com o arquivo. Não há como trazer de volta."}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="danger"
              size="sm"
              disabled={pendente}
              onClick={() => decidir(true)}
            >
              {pendente && <Loader2 size={15} className="animate-spin" />}
              Confirmar: tirar {oQue} do ar
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
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="danger"
            size="sm"
            disabled={pendente}
            onClick={() => setConfirmando(true)}
          >
            <X size={15} />
            Tirar do ar
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pendente}
            onClick={() => decidir(false)}
          >
            <Check size={15} />
            Descartar denúncia
          </Button>
        </div>
      )}
      {erro && (
        <p role="alert" className="text-danger text-sm">
          {erro}
        </p>
      )}
    </div>
  );
}
