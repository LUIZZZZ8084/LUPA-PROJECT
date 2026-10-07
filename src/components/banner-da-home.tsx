import Image from "next/image";

/**
 * O banner do topo da home (#372).
 *
 * É onde mora o `<h1>` da página, visível. O título é **texto**, e não parte
 * da imagem: a arte que o Luiz enviou trazia o título, a frase de apoio e a
 * logo desenhados dentro dela, e isso não serve aqui. Texto dentro de imagem
 * não é lido por leitor de tela nem pelo buscador, não escala (a 375 px a
 * frase de apoio ficaria com uns 7 px) e repetiria a logo que já está no
 * cabeçalho. Da arte ficou o que é imagem de verdade: a foto e as faixas
 * verdes, recortadas da metade direita (`public/banner/trabalhador.webp`).
 *
 * **O banner tem cores próprias, nos dois temas.** A foto tem fundo claro e
 * não existe versão escura dela, então o cartão é um bloco claro mesmo com
 * o app no escuro, como um cartaz. Por isso o texto usa cores fixas, e não
 * os tokens `ink` e `muted`, que no escuro ficam claros e sumiriam sobre
 * este fundo.
 *
 * A borda esquerda da foto some num degradê (`mask-image`) para se misturar
 * ao fundo do cartão, que é da cor da borda dela. A foto é decorativa
 * (`alt=""`): ela não informa nada que o texto não diga.
 */
const DEGRADE_DA_FOTO = "linear-gradient(to right, transparent 0%, #000 24%)";

export function BannerDaHome() {
  return (
    <section className="relative flex h-[10rem] items-center overflow-hidden rounded-[var(--radius-card)] border border-[#cfe3b0] bg-gradient-to-r from-[#eef6e1] to-[#e2efcd] sm:h-[17rem]">
      <div className="relative z-10 max-w-[10.5rem] pl-5 sm:max-w-md sm:pl-10">
        <h1 className="font-bold text-[#12161b] text-[1.3rem] leading-[1.12] tracking-tight sm:text-4xl">
          Encontre seu próximo trabalho
        </h1>
        <p className="mt-2 text-[#4a5361] text-[12.5px] leading-snug sm:mt-3 sm:text-base sm:leading-relaxed">
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
        className="absolute right-0 bottom-0 h-full w-auto max-w-none"
        style={{
          WebkitMaskImage: DEGRADE_DA_FOTO,
          maskImage: DEGRADE_DA_FOTO,
        }}
      />
    </section>
  );
}
