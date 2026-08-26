import { Sparkles } from "lucide-react";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Panel } from "@/components/ui/card";
import type { VagaComRecomendados } from "@/server/candidaturas/recomendados";

/**
 * "Recomendados para você".
 *
 * Cada linha diz **por que** aquela pessoa está ali — quais habilidades
 * casaram com o que a vaga pede. Recomendação sem motivo é adivinhação:
 * quem recebe não tem como discordar do critério, e a primeira vez que
 * discordar em silêncio deixa de olhar o bloco.
 */
export function Recomendados({ vagas }: { vagas: VagaComRecomendados[] }) {
  // Sem nada a recomendar, o bloco não aparece. Título com estado vazio
  // ocuparia a parte mais valiosa da tela para dizer "nada aqui".
  if (vagas.length === 0) return null;

  return (
    <section className="mt-8">
      <h2 className="mb-1 flex items-center gap-2 text-base font-bold">
        <Sparkles size={17} className="text-empresas" />
        Recomendados para você
      </h2>
      <p className="mb-3 text-xs text-muted">
        Entre quem já se candidatou, quem mais combina com o que cada vaga pede.
      </p>

      <div className="space-y-4">
        {vagas.map((vaga) => (
          <Panel key={vaga.vagaId} className="p-4 sm:p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-sm font-semibold">{vaga.titulo}</h3>
              <p className="text-[11px] text-muted">
                pede {vaga.pedidas.length}{" "}
                {vaga.pedidas.length === 1 ? "habilidade" : "habilidades"}
              </p>
            </div>

            <ul className="mt-3 space-y-3">
              {vaga.recomendados.map((r) => (
                <li key={r.candidatura.id}>
                  <Link
                    href={`/empresa/candidaturas/${r.candidatura.id}`}
                    className="flex items-start gap-3 rounded-xl p-2 transition-colors hover:bg-panel-2"
                  >
                    <Avatar
                      name={r.candidatura.candidate.full_name}
                      src={r.candidatura.candidate.avatar_url}
                      size="sm"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {r.candidatura.candidate.full_name}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted">
                        {r.casadas.length} de {r.deQuantas} habilidades
                      </p>

                      {/*
                        O texto que o candidato escreveu, não a forma
                        interna: quem lê precisa reconhecer as próprias
                        palavras para confiar no casamento.
                      */}
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {r.casadas.map((h) => (
                          <Badge key={h.canonica} tone="vagas">
                            {h.texto}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
        ))}
      </div>
    </section>
  );
}
