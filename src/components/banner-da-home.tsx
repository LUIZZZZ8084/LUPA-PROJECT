import Image from "next/image";

/**
 * O banner do topo da home (#372, #374).
 *
 * É onde mora o `<h1>` da página, visível. O título é **texto**, e não parte
 * da imagem: a arte que o Luiz enviou trazia o título, a frase de apoio e a
 * logo desenhados dentro dela, e isso não serve aqui. Texto dentro de imagem
 * não é lido por leitor de tela nem pelo buscador, não escala (a 375 px a
 * frase de apoio ficaria com uns 7 px) e repetiria a logo que já está no
 * cabeçalho. Da arte ficou o que é imagem de verdade: a foto e as faixas
 * verdes, recortadas da metade direita (`public/banner/trabalhador.webp`).
 *
 * **Uma foto por tema.** A da arte tem fundo verde claro, e num app escuro
 * ela virava um cartaz claro no meio da tela. No escuro entra outra versão
 * (`trabalhador-escuro.webp`): o homem recortado do fundo, com transparência,
 * sobre um fundo verde fechado e faixas inclinadas desenhadas em CSS. As
 * cores do cartão e do texto vêm de variáveis (`--banner-*`, em
 * `globals.css`), como o degradê da logo.
 *
 * As duas imagens estão no HTML, e a errada fica escondida por CSS
 * (`dark:hidden`, `hidden dark:block`), porque o tema só se sabe no
 * navegador. A do escuro carrega sob demanda: uma `<img>` preguiçosa sem
 * caixa de layout não é baixada, então quem usa o claro não paga por ela.
 *
 * Na foto clara, a borda esquerda some num degradê (`mask-image`) para se
 * misturar ao fundo do cartão, que é da cor da borda dela. As duas fotos são
 * decorativas (`alt=""`): elas não informam nada que o texto não diga.
 */
const DEGRADE_DA_FOTO = "linear-gradient(to right, transparent 0%, #000 24%)";

export function BannerDaHome() {
  return (
    <section className="relative flex h-[10rem] items-center overflow-hidden rounded-[var(--radius-card)] border border-[color:var(--banner-borda)] bg-[linear-gradient(to_right,var(--banner-de),var(--banner-ate))] sm:h-[17rem]">
      {/* As faixas só existem no escuro: no claro elas já estão na foto. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-4 -right-6 hidden h-[140%] w-28 skew-x-[-18deg] bg-vagas/15 sm:w-44 dark:block"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-4 right-24 hidden h-[140%] w-8 skew-x-[-18deg] bg-vagas/25 sm:right-52 sm:w-10 dark:block"
      />

      <div className="relative z-10 max-w-[10.5rem] pl-5 sm:max-w-md sm:pl-10">
        <h1 className="font-bold text-[1.3rem] text-[color:var(--banner-titulo)] leading-[1.12] tracking-tight sm:text-4xl">
          Encontre seu próximo trabalho
        </h1>
        <p className="mt-2 text-[12.5px] text-[color:var(--banner-texto)] leading-snug sm:mt-3 sm:text-base sm:leading-relaxed">
          Vagas e profissionais perto de você, de forma simples e rápida.
        </p>
      </div>

      <Image
        src="/banner/trabalhador.webp"
        alt=""
        width={560}
        height={494}
        priority
        sizes="(min-width: 640px) 310px, 175px"
        className="absolute right-0 bottom-0 h-full w-auto max-w-none dark:hidden"
        style={{
          WebkitMaskImage: DEGRADE_DA_FOTO,
          maskImage: DEGRADE_DA_FOTO,
        }}
      />
      <Image
        src="/banner/trabalhador-escuro.webp"
        alt=""
        width={435}
        height={494}
        sizes="(min-width: 640px) 240px, 141px"
        className="absolute right-0 bottom-0 hidden h-full w-auto max-w-none dark:block"
      />
    </section>
  );
}
