import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * A ação principal da tela, presa no pé da janela enquanto o lugar dela ainda
 * não chegou (#479).
 *
 * "Candidatar-se" e "Conversar no WhatsApp" eram o último bloco da página:
 * no celular, mais de mil pixels abaixo do topo, depois da descrição inteira.
 * Quem queria agir tinha de rolar até o fim sem saber que o botão estava lá.
 * Aqui a ação aparece na primeira tela e acompanha a leitura.
 *
 * **É um elemento só, sem JavaScript.** `position: sticky` com `bottom` prende
 * a barra no pé da janela enquanto o lugar natural dela, logo depois do
 * painel, ainda está abaixo; ao chegar lá ela assenta e rola junto com a
 * página. Por isso a barra é irmã do painel, e não filha dele: o `<main>`
 * precisa ser o bloco que a contém, já que um elemento sticky não sai de
 * dentro do pai. Duplicar o botão (um fixo, outro no fim) obrigaria a
 * escolher qual mostrar a cada rolagem, e dois botões com o mesmo estado
 * (enviando, enviado) divergem.
 *
 * **Acima da barra inferior.** Abaixo de `md` o app tem a navegação fixa
 * embaixo (`z-40`); a barra de ação fica logo acima dela, pela altura que as
 * duas compartilham em `--barra-inferior` (`globals.css`), mais a borda de
 * 1 px e a área segura do aparelho. De `md` em diante a navegação some e a
 * barra vai ao pé da janela, como um cartão com 12 px de folga.
 *
 * **No computador ela vira cartão de coluna (#525).** A partir de `lg` a página
 * tem duas colunas e o invólucro da coluna da direita é quem fica preso sob o
 * cabeçalho; a barra deixa de ser `sticky` e acompanha o invólucro.
 *
 * **Quando a ação termina, ela solta.** Quem põe `data-acao-concluida` em
 * algum filho (a candidatura enviada) faz a barra virar um bloco comum: o
 * estado final não precisa acompanhar a tela.
 */
export function BarraDeAcaoFixa({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      data-barra-de-acao
      className={cn(
        "sticky z-20 -mx-4 mt-3 border-t border-line bg-panel/95 px-4 py-3 backdrop-blur-lg",
        "bottom-[calc(var(--barra-inferior)+1px+env(safe-area-inset-bottom))]",
        "sm:-mx-6 sm:px-6",
        "md:bottom-3 md:mx-0 md:rounded-2xl md:border md:px-4",
        // No computador (#525) quem prende é a coluna, e a barra é só o cartão.
        "lg:static lg:mt-0 lg:p-4",
        "has-[[data-acao-concluida]]:static",
        className,
      )}
    >
      {children}
    </div>
  );
}
