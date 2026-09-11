"use client";

import { useState, useTransition } from "react";
import { Select } from "@/components/ui/field";
import { APPLICATION_LABELS } from "@/lib/constants";
import type { ApplicationStatus } from "@/lib/types";
import { moverCandidatura } from "./actions";

const ESTAGIOS = Object.keys(APPLICATION_LABELS) as ApplicationStatus[];

export function MoverCandidaturaSelect({
  id,
  statusAtual,
}: {
  id: string;
  statusAtual: ApplicationStatus;
}) {
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState(statusAtual);
  const [erro, setErro] = useState<string | null>(null);

  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <Select
        aria-label="Estágio da candidatura"
        className="h-9 py-0 pl-3 text-xs"
        value={status}
        disabled={pending}
        onChange={(e) => {
          const novoStatus = e.target.value as ApplicationStatus;
          const anterior = status;
          setStatus(novoStatus);
          setErro(null);
          startTransition(async () => {
            const resposta = await moverCandidatura({ id, status: novoStatus });
            if (!resposta.ok) {
              setStatus(anterior);
              setErro(resposta.mensagem);
            }
          });
        }}
      >
        {ESTAGIOS.map((estagio) => (
          <option key={estagio} value={estagio}>
            {APPLICATION_LABELS[estagio]}
          </option>
        ))}
      </Select>
      {erro && <p className="text-[11px] text-danger">{erro}</p>}
    </div>
  );
}
