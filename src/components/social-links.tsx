import { Globe } from "lucide-react";

/**
 * Ícones de marca que o lucide-react não tem.
 *
 * O pacote parou de incluir logos de rede social por questão de marca
 * registrada; o caminho aceito é um SVG próprio, no mesmo formato que o
 * `WhatsAppIcon` já usa — `viewBox` de 24, `fill="currentColor"` para
 * herdar a cor de quem chama.
 */
function InstagramIcon({ size = 15 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      className="flex-none"
    >
      <path d="M12 2.16c3.2 0 3.58.01 4.85.07 3.25.15 4.77 1.69 4.92 4.92.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.15 3.23-1.66 4.77-4.92 4.92-1.27.06-1.64.07-4.85.07s-3.58-.01-4.85-.07c-3.26-.15-4.77-1.7-4.92-4.92-.06-1.27-.07-1.65-.07-4.85s.01-3.58.07-4.85c.15-3.23 1.67-4.77 4.92-4.92 1.27-.06 1.65-.07 4.85-.07zM12 0C8.74 0 8.33.01 7.05.07 2.7.27.27 2.7.07 7.05.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.2 4.35 2.62 6.78 6.98 6.98C8.33 23.99 8.74 24 12 24s3.67-.01 4.95-.07c4.35-.2 6.78-2.62 6.98-6.98.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.2-4.34-2.62-6.78-6.98-6.98C15.67.01 15.26 0 12 0zm0 5.84A6.16 6.16 0 1 0 18.16 12 6.16 6.16 0 0 0 12 5.84zM12 16a4 4 0 1 1 4-4 4 4 0 0 1-4 4zm6.41-10.85a1.44 1.44 0 1 0 1.44 1.44 1.44 1.44 0 0 0-1.44-1.44z" />
    </svg>
  );
}

function FacebookIcon({ size = 15 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      className="flex-none"
    >
      <path d="M22 12a10 10 0 1 0-11.5 9.87v-6.98H7.9V12h2.6V9.8c0-2.56 1.53-3.98 3.87-3.98 1.12 0 2.3.2 2.3.2v2.5h-1.3c-1.28 0-1.68.8-1.68 1.62V12h2.85l-.46 2.89h-2.4v6.98A10 10 0 0 0 22 12z" />
    </svg>
  );
}

type Rede = "instagram" | "facebook" | "site";

const APARENCIA: Record<
  Rede,
  { rotulo: string; icone: React.ReactNode; cor: string }
> = {
  instagram: {
    rotulo: "Instagram",
    icone: <InstagramIcon />,
    cor: "text-instagram",
  },
  facebook: {
    rotulo: "Facebook",
    icone: <FacebookIcon />,
    cor: "text-facebook",
  },
  // Sem marca própria — ícone genérico, cor neutra.
  site: { rotulo: "Site", icone: <Globe size={15} />, cor: "text-ink" },
};

/**
 * Um link de rede social, com ícone e cor da marca.
 *
 * Era texto cinza sublinhado — "Instagram" escrito por extenso, do
 * tamanho de qualquer outro texto secundário da tela. Reclamação do Luiz
 * em 03/09/2026: perto de quem está decidindo contratar, o link precisa
 * se destacar como botão, não se perder como legenda.
 */
export function SocialLink({ rede, url }: { rede: Rede; url: string }) {
  const { rotulo, icone, cor } = APARENCIA[rede];

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1.5 rounded-full border border-line bg-panel-2 px-3 py-1.5 font-medium text-sm transition-colors hover:border-current ${cor}`}
    >
      {icone}
      {rotulo}
    </a>
  );
}

/**
 * A linha de redes de um perfil — site, Instagram e Facebook, os três
 * opcionais. Some inteira quando nenhum está preenchido, em vez de deixar
 * um espaço vazio esperando por um link que não veio.
 */
export function SocialLinks({
  site,
  instagram,
  facebook,
}: {
  site?: string | null;
  instagram?: string | null;
  facebook?: string | null;
}) {
  if (!site && !instagram && !facebook) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {site && <SocialLink rede="site" url={site} />}
      {instagram && <SocialLink rede="instagram" url={instagram} />}
      {facebook && <SocialLink rede="facebook" url={facebook} />}
    </div>
  );
}
