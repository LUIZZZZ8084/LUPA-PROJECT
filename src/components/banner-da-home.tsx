import Image from "next/image";

/**
 * O banner do topo da home (#372, #374, #378).
 *
 * É onde mora o `<h1>` da página, visível. O título é **texto**, e não parte
 * da imagem: a arte que o Luiz enviou trazia o título, a frase de apoio e a
 * logo desenhados dentro dela, e isso não serve aqui. Texto dentro de imagem
 * não é lido por leitor de tela nem pelo buscador, não escala (a 375 px a
 * frase de apoio ficaria com uns 7 px) e repetiria a logo que já está no
 * cabeçalho.
 *
 * **A composição é a mesma nos dois temas; só a cor muda.** Era diferente: o
 * claro usava a foto com o fundo da arte, e o escuro, o homem recortado
 * sobre faixas em CSS. Quem alternava o tema via o banner trocar de forma, e
 * isso incomoda (#378). Agora há uma foto só, o homem recortado do fundo
 * (`public/banner/trabalhador-recortado.webp`, WebP com transparência), sobre as
 * mesmas duas faixas inclinadas, com a mesma posição e as mesmas medidas.
 * Fundo, borda, faixas e texto vêm de variáveis (`--banner-*`, em
 * `globals.css`), como o degradê da logo.
 *
 * **O arquivo tem nome novo de propósito.** O otimizador de imagens do Next
 * guarda o resultado pelo endereço, e trocar o conteúdo de
 * `trabalhador.webp` mantendo o nome serviria a foto antiga a quem já tivesse
 * aberto a home, no desenvolvimento e em produção. Nome novo, endereço novo.
 *
 * A foto é decorativa (`alt=""`): ela não informa nada que o texto não diga.
 */
export function BannerDaHome() {
  return (
    <section className="relative flex h-[10rem] items-center overflow-hidden rounded-[var(--radius-card)] border border-[color:var(--banner-borda)] bg-[linear-gradient(to_right,var(--banner-de),var(--banner-ate))] sm:h-[17rem]">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-4 -right-6 h-[140%] w-28 skew-x-[-18deg] [background:var(--banner-faixa-a)] sm:w-44"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-4 right-24 h-[140%] w-8 skew-x-[-18deg] [background:var(--banner-faixa-b)] sm:right-52 sm:w-10"
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
        src="/banner/trabalhador-recortado.webp"
        alt=""
        width={435}
        height={494}
        priority
        sizes="(min-width: 640px) 240px, 141px"
        className="absolute right-0 bottom-0 h-full w-auto max-w-none"
      />
    </section>
  );
}
