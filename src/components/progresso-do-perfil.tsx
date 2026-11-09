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
 *
 * O prestador usa a mesma barra para o anúncio (#602), na cor de serviços e
 * com o título e o motivo dele. O padrão continua sendo o do currículo.
 */
export function ProgressoDoPerfil({
  porcento,
  faltas,
  className,
  titulo = "Seu currículo",
  motivo = "A empresa lê até o fim quem preenche o currículo.",
  href = "/perfil/editar",
  tom = "vagas",
}: {
  porcento: number;
  faltas: readonly string[];
  className?: string;
  /** O sujeito da frase: "Seu currículo está 50% completo". */
  titulo?: string;
  /** Por que vale preencher, em uma frase. */
  motivo?: string;
  /** Para onde o botão leva: onde se preenche a primeira parte que falta. */
  href?: string;
  tom?: "vagas" | "servicos";
}) {
  if (faltas.length === 0) return null;

  return (
    <Panel
      className={cn(
        tom === "vagas" ? "border-vagas/25" : "border-servicos/25",
        className,
      )}
    >
      <h2 className="font-bold text-base">
        {titulo} está {porcento}% completo
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
          className={cn(
            "h-full rounded-full transition-[width]",
            tom === "vagas" ? "bg-vagas" : "bg-servicos",
          )}
          style={{ width: `${porcento}%` }}
        />
      </div>
      <p className="mt-3 text-muted text-sm leading-relaxed">
        {motivo} {faltas.length === 1 ? "Falta" : "Faltam"}:
      </p>
      <ul className="mt-2 flex flex-wrap gap-2">
        {faltas.map((f) => (
          <li key={f}>
            <Badge tone="outline">{f}</Badge>
          </li>
        ))}
      </ul>
      <ButtonLink href={href} variant={tom} size="sm" className="mt-4">
        Completar meu perfil
      </ButtonLink>
    </Panel>
  );
}
