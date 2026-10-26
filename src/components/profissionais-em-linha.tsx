import { Star } from "lucide-react";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { formatRating } from "@/lib/format";
import type { ProviderListing } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Os profissionais da home em linha: avatar, primeiro nome, ofício e nota
 * (#372).
 *
 * O card completo (`ProviderCard`) continua na lista de Serviços. Aqui a
 * ideia é outra: mostrar gente, e deixar a conversa para o perfil. Por isso
 * não há preço, nem botão de contato, nem telefone: **o que não é lido não
 * sai no HTML**, e a home continua sem `wa.me` para quem não tem sessão
 * (o teste do muro de login cobra isso).
 *
 * **O que a linha não diz.** Não há ponto verde de "online" nem a palavra
 * "disponível": o app não sabe quem está disponível, e afirmar isso seria
 * a promessa que a #237 tirou da tela. A nota só aparece com avaliação de
 * verdade; sem ela, o ofício basta.
 */
export function ProfissionaisEmLinha({
  providers,
  className,
}: {
  providers: ProviderListing[];
  /** Ajuste de colunas por quem usa: na home, duas na lateral do computador. */
  className?: string;
}) {
  return (
    <ul className={cn("stagger grid grid-cols-4 gap-2", className)}>
      {providers.map((p) => (
        <li key={p.profile_id} className="min-w-0">
          <Link
            href={`/servicos/${p.profile_id}`}
            className="group flex min-h-11 flex-col items-center gap-1.5 rounded-xl px-1 py-2 text-center transition-colors hover:bg-panel-2"
          >
            <Avatar name={p.full_name} src={p.avatar_url} size="lg" />
            <span className="block w-full truncate font-semibold text-xs leading-tight group-hover:text-servicos">
              {primeiroNome(p.full_name)}
            </span>
            <span className="block w-full truncate text-xs text-muted leading-tight">
              {p.category.name}
            </span>
            {p.review_count > 0 && (
              // A estrela diz o que o número é: sozinho, "5,0" podia ser
              // preço, idade ou código (#481). O leitor de tela ouve "Nota".
              <span className="inline-flex items-center gap-0.5 text-xs font-medium text-ink leading-tight">
                <Star
                  size={11}
                  className="text-star"
                  fill="currentColor"
                  aria-hidden
                />
                <span className="sr-only">Nota </span>
                {formatRating(p.avg_rating)}
              </span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] ?? nome;
}
