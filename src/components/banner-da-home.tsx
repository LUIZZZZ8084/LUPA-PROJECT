import { MapPin } from "lucide-react";
import Image from "next/image";
import type { ReactNode } from "react";

/**
 * O banner do topo da home (#372, #374, #378), que no computador é o hero
 * inteiro (#465).
 *
 * É onde mora o `<h1>` da página, visível. O título é **texto**, e não parte
 * da imagem: a arte que o Luiz enviou trazia o título, a frase de apoio e a
 * logo desenhados dentro dela, e isso não serve aqui. Texto dentro de imagem
 * não é lido por leitor de tela nem pelo buscador, não escala (a 375 px a
 * frase de apoio ficaria com uns 7 px) e repetiria a logo que já está no
 * cabeçalho.
 *
 * **No computador, a busca mora dentro do banner (#465).** Era um banner da
 * largura toda com o título à esquerda, a foto à direita e o meio vazio; o
 * selo de lugar, a busca e os números vinham soltos embaixo, cada um com uma
 * largura. Reclamação do Luiz em 14/10/2026, com print: "está horrível".
 * Agora, a partir de `lg`, selo, título, frase, busca e números formam uma
 * coluna à esquerda, dentro do banner, e a foto ocupa a direita.
 *
 * **No celular e no tablet, nada muda:** o banner é a faixa do título com a
 * foto, e o resto vem embaixo. A busca não cabe ao lado da foto numa tela
 * estreita, e enfiá-la dentro do banner deixaria a foto atrás dos campos.
 *
 * **As duas composições saem do mesmo DOM, sem nada duplicado além do selo.**
 * O banner é uma grade, e o fundo (gradiente, faixas, foto) é um item dela
 * que, no celular, ocupa só a primeira linha — a do título, com 10rem — e, no
 * computador, as três linhas e as duas colunas. A posição vai com início e
 * fim (`lg:row-[1/4]`), e não com `row-span-3`: no Tailwind v4 o `span`
 * reescreve `grid-row` inteiro, apaga o `row-start-1`, e o fundo ia parar
 * depois do conteúdo, com altura zero. Título, busca e números
 * são itens da mesma grade, por cima do fundo onde ele está. Duplicar a busca
 * para cada tamanho de tela daria dois formulários com estado próprio, e o
 * que a pessoa escolhesse num sumiria ao girar o tablet. O selo é duplicado
 * por ser só texto: em cima do título no computador, embaixo do banner no
 * celular, e o que não está à vista sai com `hidden`, longe do leitor de
 * tela também.
 *
 * **A composição é a mesma nos dois temas; só a cor muda.** Era diferente: o
 * claro usava a foto com o fundo da arte, e o escuro, o homem recortado
 * sobre faixas em CSS. Quem alternava o tema via o banner trocar de forma, e
 * isso incomoda (#378). Agora há uma foto só, o homem recortado do fundo
 * (`public/banner/trabalhador-recortado-v2.webp`, WebP com transparência),
 * sobre as mesmas duas faixas inclinadas, com a mesma posição e as mesmas
 * medidas. Fundo, borda, faixas e texto vêm de variáveis (`--banner-*`, em
 * `globals.css`), como o degradê da logo.
 *
 * **A foto é cortada acima do vão entre os antebraços (#382).** O recorte
 * original deixava um buraco transparente de uns 20 × 10 px entre os braços,
 * aberto para a borda de baixo. A foto fica encostada embaixo, então o que
 * está atrás, a faixa e o fundo do tema, aparecia por ali, e a cor mudava
 * com o tema. O arquivo termina antes do vão: 435 × 476, e não 435 × 494.
 *
 * **No computador a foto tem teto de altura (`lg:max-h-[26rem]`).** O banner
 * ficou mais alto com a busca dentro, e a foto, que acompanha a altura,
 * cresceria até invadir a coluna da busca em 1024 px. Com o teto ela fica
 * encostada embaixo, à direita, e o que sobra em cima é faixa.
 *
 * **O arquivo tem nome novo de propósito**, a cada troca de conteúdo. O
 * otimizador de imagens do Next guarda o resultado pelo endereço, e trocar o
 * conteúdo mantendo o nome serviria a foto antiga a quem já tivesse aberto a
 * home, no desenvolvimento e em produção. Nome novo, endereço novo.
 *
 * **O pé da foto some num desfoque discreto.** Cortada, a foto termina seca na
 * borda do banner, com os braços interrompidos. Por cima dela, uma camada com
 * a mesma caixa (mesma altura, mesmo teto, mesma proporção 435 × 476, colada
 * à direita e embaixo) borra o que está atrás, mais forte na borda e some uns
 * 11% acima dela (`backdrop-filter` com máscara, 2 px de raio). Não tem cor:
 * borra pixels, não pinta nenhum, então é a mesma nos dois temas. Onde o
 * navegador não sabe fazer isso, a camada simplesmente não aparece e a foto
 * fica como estava.
 *
 * A foto é decorativa (`alt=""`): ela não informa nada que o texto não diga.
 */
export function BannerDaHome({
  local,
  busca,
  rodape,
}: {
  /** O selo de lugar: a cidade da conta, ou o alcance do app. */
  local?: string;
  /** A busca do hero. */
  busca?: ReactNode;
  /** Os números e, para visitante, o convite para criar conta. */
  rodape?: ReactNode;
}) {
  return (
    <section className="grid grid-cols-1 lg:grid-cols-[minmax(0,36rem)_minmax(0,1fr)] xl:grid-cols-[minmax(0,40rem)_minmax(0,1fr)]">
      <div
        data-fundo-do-banner
        className="relative col-start-1 row-start-1 h-[10rem] overflow-hidden rounded-[var(--radius-card)] border border-[color:var(--banner-borda)] bg-[linear-gradient(to_right,var(--banner-de),var(--banner-ate))] sm:h-[17rem] lg:col-[1/-1] lg:row-[1/4] lg:h-auto"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -top-4 -right-6 h-[140%] w-28 skew-x-[-18deg] [background:var(--banner-faixa-a)] sm:w-44"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -top-4 right-24 h-[140%] w-8 skew-x-[-18deg] [background:var(--banner-faixa-b)] sm:right-52 sm:w-10"
        />

        <Image
          src="/banner/trabalhador-recortado-v2.webp"
          alt=""
          width={435}
          height={476}
          priority
          sizes="(min-width: 1024px) 380px, (min-width: 640px) 248px, 146px"
          className="absolute right-0 bottom-0 h-full w-auto max-w-none lg:max-h-[26rem]"
        />
        <div
          aria-hidden
          data-desfoque-do-pe
          className="pointer-events-none absolute right-0 bottom-0 aspect-[435/476] h-full backdrop-blur-[2px] [mask-image:linear-gradient(to_top,black,transparent_11%)] lg:max-h-[26rem]"
        />
      </div>

      <div className="relative z-10 col-start-1 row-start-1 max-w-[10.5rem] self-center pl-5 sm:max-w-md sm:pl-10 lg:max-w-none lg:self-start lg:pt-12 lg:pl-10 xl:pl-14">
        {local && (
          <SeloDeLugar local={local} className="mb-4 hidden lg:inline-flex" />
        )}
        <h1 className="font-bold text-[1.3rem] text-[color:var(--banner-titulo)] leading-[1.12] tracking-tight sm:text-4xl lg:text-5xl">
          Encontre seu próximo trabalho
        </h1>
        <p className="mt-2 text-[12.5px] text-[color:var(--banner-texto)] leading-snug sm:mt-3 sm:text-base sm:leading-relaxed lg:text-lg">
          Vagas e profissionais perto de você, de forma simples e rápida.
        </p>
      </div>

      {local && (
        <div className="row-start-2 mt-4 sm:mt-6 lg:hidden">
          <SeloDeLugar local={local} className="inline-flex" />
        </div>
      )}

      {busca && (
        <div className="relative z-10 row-start-3 lg:col-start-1 lg:row-start-2 lg:pl-10 xl:pl-14 lg:[&>div]:mt-6">
          {busca}
        </div>
      )}

      {rodape && (
        <div className="relative z-10 row-start-4 lg:col-start-1 lg:row-start-3 lg:pb-12 lg:pl-10 xl:pl-14">
          {rodape}
        </div>
      )}
    </section>
  );
}

/**
 * O pino de localização promete "aqui é onde você está" — e até a #107 dizia
 * sempre "Mato Grosso · começando por Sinop", pra quem quer que fosse, de
 * qualquer cidade. A página passa a cidade da conta, a mesma que ordena a
 * busca por perto; sem conta, ou com conta sem cidade, passa o alcance do
 * app, o Brasil inteiro desde a #301.
 */
function SeloDeLugar({
  local,
  className,
}: {
  local: string;
  className: string;
}) {
  return (
    <span
      className={`items-center gap-1.5 rounded-full border border-line bg-panel/60 px-3 py-1 font-medium text-[11px] text-muted ${className}`}
    >
      <MapPin size={12} className="text-vagas" aria-hidden />
      {local}
    </span>
  );
}
