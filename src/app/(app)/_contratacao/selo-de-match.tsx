import { Badge } from "@/components/ui/badge";
import { LIMIAR_MUITO_COMPATIVEL } from "@/lib/resultado-da-vaga";

export interface MatchParaSelo {
  porcentagem: number;
  pontos: number;
  deQuantas: number;
}

/**
 * O quanto o candidato casa com a vaga a que se candidatou.
 *
 * Sem match, não desenha nada: a vaga não declarou habilidade e o título
 * não deu pista. Mostrar "0%" ali seria afirmar que o candidato não tem nada
 * do que se pede, quando a verdade é que ninguém disse o que se pede.
 *
 * O número vive no `aria-label` por extenso porque o selo mostra só "72%",
 * e "72%" sozinho não diz de quê — nem para quem usa leitor de tela, nem
 * para quem está no celular, onde `title` não existe. Quem quiser o detalhe
 * abre a ficha.
 *
 * Mora fora do painel desde a #511, porque o funil em colunas desenha o
 * mesmo selo em cada card.
 */
export function SeloDeMatch({ match }: { match: MatchParaSelo | undefined }) {
  if (!match) return null;

  const tone =
    match.porcentagem >= LIMIAR_MUITO_COMPATIVEL
      ? "vagas"
      : match.porcentagem >= 40
        ? "warn"
        : "neutral";

  return (
    <Badge
      tone={tone}
      className="flex-none"
      aria-label={`Combina com ${match.pontos} de ${match.deQuantas} habilidades que a vaga pede`}
    >
      {match.porcentagem}%
    </Badge>
  );
}
