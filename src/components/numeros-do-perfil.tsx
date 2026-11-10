import { Eye, MessageCircle } from "lucide-react";
import { Panel } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * O que a vitrine trouxe ao prestador no último mês (#604).
 *
 * Ele paga a mensalidade e não via retorno nenhum dentro do app. Dois
 * números, os que ele entende sem explicação: quantas vezes abriram o
 * perfil e quantas chamaram no WhatsApp.
 *
 * **A tela diz que é contagem, não gente**, como a da empresa diz das
 * visualizações de vaga: a Lupa não guarda quem visitou, então a mesma
 * pessoa abrindo duas vezes conta duas.
 */
export function NumerosDoPerfil({
  visitas,
  contatos,
  dias,
  className,
}: {
  visitas: number;
  contatos: number;
  dias: number;
  className?: string;
}) {
  return (
    <Panel className={cn("border-servicos/25", className)}>
      <h2 className="font-bold text-base">
        Seu perfil nos últimos {dias} dias
      </h2>
      <dl className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-panel-2 p-3.5">
          <dt className="flex items-center gap-1.5 text-muted text-xs">
            <Eye size={14} aria-hidden />
            {visitas === 1 ? "Visita" : "Visitas"}
          </dt>
          <dd className="mt-1 font-bold text-2xl tabular-nums">{visitas}</dd>
        </div>
        <div className="rounded-xl bg-panel-2 p-3.5">
          <dt className="flex items-center gap-1.5 text-muted text-xs">
            <MessageCircle size={14} aria-hidden />
            {contatos === 1 ? "Chamada no WhatsApp" : "Chamadas no WhatsApp"}
          </dt>
          <dd className="mt-1 font-bold text-2xl tabular-nums">{contatos}</dd>
        </div>
      </dl>
      <p className="mt-3 text-faint text-xs leading-relaxed">
        {visitas === 0 && contatos === 0
          ? "Divulgue o link do seu perfil para os números começarem a subir."
          : "É contagem de cliques, não de pessoas: a Lupa não guarda quem visitou."}
      </p>
    </Panel>
  );
}
