import Link from "next/link";
import { LupaLogo } from "@/components/brand/logo";
import { CanalDeContato } from "@/components/canal-de-contato";
import { LinksInstitucionais } from "@/components/links-institucionais";

/**
 * O rodapé do computador (#525).
 *
 * No celular o app termina na navegação inferior e não tem rodapé. Num
 * monitor a página simplesmente acabava, sem nada que dissesse onde se está
 * ou como falar com a Lupa. Este rodapé tem a mesma largura e as mesmas bordas
 * do cabeçalho.
 *
 * **Só existe a partir de `lg`** (`hidden`): abaixo disso nada muda. Por isso
 * ele assume o que o celular mostra em outros lugares (o canal de contato do
 * visitante, os links institucionais do perfil e a linha de direitos da home),
 * que ficam `lg:hidden` nesses lugares. Mostrar os dois no computador
 * repetiria o mesmo link duas vezes na mesma tela.
 *
 * O canal de contato é só de quem não tem conta, como no layout do app: quem
 * já tem uma encontra o caminho de contato de outras formas.
 *
 * "Palu" é "Lupa" com as duas metades trocadas: LU (Luiz) + PA (Paulinho)
 * virou PA + LU, o nome fantasia do registro na Receita (#235).
 */
export function RodapeDoComputador({ visitante }: { visitante: boolean }) {
  return (
    <footer className="mt-4 hidden border-t border-line bg-panel/50 lg:block">
      <div className="mx-auto grid max-w-site grid-cols-[1fr_auto] items-start gap-x-10 gap-y-6 px-8 py-8">
        <div>
          <Link
            href="/"
            aria-label="Lupa — início"
            className="inline-flex h-11 items-center"
          >
            <LupaLogo size={26} />
          </Link>
          <p className="mt-1 max-w-md text-muted text-sm leading-relaxed">
            Vagas e profissionais perto de você, de forma simples e rápida.
          </p>
        </div>

        <div className="flex flex-col items-end gap-3">
          {visitante && <CanalDeContato />}
          <LinksInstitucionais />
        </div>

        <p className="col-span-2 border-line border-t pt-5 text-faint text-xs">
          Lupa · © {new Date().getFullYear()} PALU TECH. Todos os direitos
          reservados.
        </p>
      </div>
    </footer>
  );
}
