import { LupaMark } from "@/components/brand/logo";

/**
 * O banner do topo da home (#372).
 *
 * É onde mora o `<h1>` da página, e agora visível: o título do #364 tinha
 * saído da tela por ser grande demais ao lado da busca, e este é menor, é
 * uma frase de convite e divide a linha com o símbolo.
 *
 * **Sem foto, por enquanto.** A referência de desenho tinha uma pessoa à
 * direita; o sistema de design da Lupa dizia "não introduza fotografia", e
 * foto precisa de direito de uso. O símbolo da logo ocupa o lugar, sobre
 * faixas inclinadas em verde claro, e a foto pode entrar depois sem mexer
 * no resto: é só o que fica à direita.
 *
 * As faixas são só enfeite (`aria-hidden`) e usam a cor da marca a pouca
 * opacidade, porque o aro da logo é um degradê de verde e sumiria sobre
 * uma faixa de verde cheio.
 */
export function BannerDaHome() {
  return (
    <section className="relative overflow-hidden rounded-[var(--radius-card)] border border-vagas/20 bg-vagas/10">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-4 -right-6 h-[140%] w-28 skew-x-[-18deg] bg-vagas/15 sm:w-44"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-4 right-24 h-[140%] w-8 skew-x-[-18deg] bg-vagas/20 sm:right-52 sm:w-10"
      />

      <div className="relative flex items-center justify-between gap-3 p-5 sm:p-8">
        <div className="max-w-[12.5rem] sm:max-w-md">
          <h1 className="font-bold text-[1.375rem] leading-[1.12] tracking-tight sm:text-4xl">
            Encontre seu próximo trabalho
          </h1>
          <p className="mt-2 text-[13px] text-muted leading-snug sm:mt-3 sm:text-base sm:leading-relaxed">
            Vagas e profissionais perto de você, de forma simples e rápida.
          </p>
        </div>

        <LupaMark
          size={84}
          className="mr-1 sm:mr-6 sm:h-[128px] sm:w-[128px]"
        />
      </div>
    </section>
  );
}
