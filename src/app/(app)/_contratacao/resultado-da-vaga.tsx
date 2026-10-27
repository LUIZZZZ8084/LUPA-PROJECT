import { Eye, Inbox, Plus, Sparkles } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { pluralize } from "@/lib/format";
import type { ResultadoDaVaga } from "@/lib/resultado-da-vaga";

/**
 * O resultado de uma vaga, na linha dela (#492).
 *
 * A empresa publica, espera, e não via o que a Lupa fez por ela: sem prova de
 * resultado ela não renova. Aqui ficam juntos o que o Instagram não tem —
 * visualizações, candidaturas e quantas combinam com o que a vaga pede.
 *
 * **Muito compatíveis só aparece quando dá para comparar.** Zero é uma
 * afirmação ("comparei, e ninguém combina"); vaga que não declara habilidade,
 * ou candidato que não declarou nenhuma, ficam fora da conta, e então a
 * linha não menciona o número em vez de mentir com um zero.
 *
 * Vaga encerrada ou vencida mostra o resumo final e o caminho para continuar:
 * publicar outra parecida, que já vem preenchida com o texto desta.
 */
export function ResultadoDaVagaLinha({
  resultado,
  finalizada,
  vagaId,
  base,
}: {
  resultado: ResultadoDaVaga;
  /** Encerrada pela empresa, ou vencida: o número é o final. */
  finalizada: boolean;
  vagaId: string;
  /** `/empresa` ou `/contratar`: o caminho de publicar acompanha a área. */
  base: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-muted text-xs">
      {finalizada && (
        <span className="font-semibold text-ink">Resumo final</span>
      )}
      <span className="inline-flex items-center gap-1">
        <Eye size={13} className="flex-none" aria-hidden />
        {pluralize(resultado.visualizacoes, "visualização", "visualizações")}
      </span>
      <span className="inline-flex items-center gap-1">
        <Inbox size={13} className="flex-none" aria-hidden />
        {pluralize(resultado.candidaturas, "candidatura", "candidaturas")}
      </span>
      {resultado.muitoCompativeis !== null && (
        <span className="inline-flex items-center gap-1">
          <Sparkles size={13} className="flex-none" aria-hidden />
          {pluralize(
            resultado.muitoCompativeis,
            "muito compatível",
            "muito compatíveis",
          )}
        </span>
      )}

      {finalizada && (
        <ButtonLink
          href={`${base}/vagas/nova?modelo=${encodeURIComponent(vagaId)}`}
          variant="outline"
          size="sm"
          className="ml-auto"
        >
          <Plus size={14} />
          Publicar outra parecida
        </ButtonLink>
      )}
    </div>
  );
}
