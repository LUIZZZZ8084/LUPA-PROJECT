import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * "Seu currículo está 50% completo" (#550).
 *
 * Tarefa começada e não terminada fica na cabeça (efeito Zeigarnik): uma
 * barra pela metade puxa a pessoa de volta mais do que um aviso de "perfil
 * incompleto". Antes, só o gerador de currículo dizia o que faltava, e só a
 * quem chegava até ele. A barra mostra a porcentagem, as partes vazias e o
 * caminho para preencher. O título fala em currículo, e não em perfil, porque
 * são as partes do currículo que ele conta, e "Perfil" já é o título da
 * página onde ele aparece.
 *
 * **Com tudo preenchido ela some.** Um selo de 100% para sempre seria ruído,
 * a mesma lição do selo de telefone (#209).
 */
export function ProgressoDoPerfil({
  porcento,
  faltas,
  className,
}: {
  porcento: number;
  faltas: readonly string[];
  className?: string;
}) {
  if (faltas.length === 0) return null;

  return (
    <Panel className={cn("border-vagas/25", className)}>
      <h2 className="font-bold text-base">
        Seu currículo está {porcento}% completo
      </h2>
      <div
        role="progressbar"
        aria-label="Perfil preenchido"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={porcento}
        className="mt-3 h-2 overflow-hidden rounded-full bg-panel-3"
      >
        <div
          className="h-full rounded-full bg-vagas transition-[width]"
          style={{ width: `${porcento}%` }}
        />
      </div>
      <p className="mt-3 text-muted text-sm leading-relaxed">
        A empresa lê até o fim quem preenche o currículo.{" "}
        {faltas.length === 1 ? "Falta" : "Faltam"}:
      </p>
      <ul className="mt-2 flex flex-wrap gap-2">
        {faltas.map((f) => (
          <li key={f}>
            <Badge tone="outline">{f}</Badge>
          </li>
        ))}
      </ul>
      <ButtonLink
        href="/perfil/editar"
        variant="vagas"
        size="sm"
        className="mt-4"
      >
        Completar meu perfil
      </ButtonLink>
    </Panel>
  );
}
